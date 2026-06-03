import type { Prisma, PrismaClient } from "@prisma/client";
import { FULL_VACANCY_RESET_CONFIRM_TEXT, cleanupTypeLabels, isProtectedVacancyForCleanup, requiresFullResetConfirmation } from "@/lib/data-cleanup-rules";

export type CleanupType = "untouched_vacancies" | "analysis_errors" | "invalid_sources" | "old_runs" | "full_vacancy_reset";
export type CleanupMode = "archive" | "delete";

export type CleanupPreview = {
  type: CleanupType;
  label: string;
  affectedVacancies: number;
  affectedSearchRuns: number;
  affectedProcessRuns: number;
  preservedApplications: number;
  preservedCoverLetters: number;
  acceptedLearningObservationsPreserved: number;
  draftLearningObservationsRelated: number;
  statuses: Record<string, number>;
  warnings: string[];
};

type Db = PrismaClient | Prisma.TransactionClient;

export async function getCleanupPreview(prisma: Db, type: CleanupType): Promise<CleanupPreview> {
  const vacancyIds = await findCleanupVacancyIds(prisma, type);
  const statusRows = vacancyIds.length
    ? await prisma.vacancy.groupBy({
        by: ["status"],
        where: { id: { in: vacancyIds } },
        _count: { _all: true }
      })
    : [];
  const [preservedApplications, preservedCoverLetters, acceptedLearningObservationsPreserved, draftLearningObservationsRelated, affectedSearchRuns, affectedProcessRuns] =
    await Promise.all([
      vacancyIds.length ? prisma.application.count({ where: { vacancyId: { in: vacancyIds } } }) : Promise.resolve(0),
      vacancyIds.length ? prisma.coverLetter.count({ where: { vacancyId: { in: vacancyIds } } }) : Promise.resolve(0),
      vacancyIds.length
        ? prisma.learningObservation.count({ where: { sourceType: "vacancy", sourceId: { in: vacancyIds }, status: "accepted" } })
        : Promise.resolve(0),
      vacancyIds.length
        ? prisma.learningObservation.count({ where: { sourceType: "vacancy", sourceId: { in: vacancyIds }, status: "draft" } })
        : Promise.resolve(0),
      type === "old_runs" || type === "full_vacancy_reset" ? prisma.searchRun.count({ where: oldRunWhere(type) }) : Promise.resolve(0),
      type === "old_runs" || type === "full_vacancy_reset" ? prisma.processRun.count({ where: oldProcessWhere(type) }) : Promise.resolve(0)
    ]);

  return {
    type,
    label: cleanupTypeLabels[type] || type,
    affectedVacancies: vacancyIds.length,
    affectedSearchRuns,
    affectedProcessRuns,
    preservedApplications,
    preservedCoverLetters,
    acceptedLearningObservationsPreserved,
    draftLearningObservationsRelated,
    statuses: Object.fromEntries(statusRows.map((row) => [row.status, row._count._all])),
    warnings: previewWarnings(type, acceptedLearningObservationsPreserved, draftLearningObservationsRelated)
  };
}

export async function applyCleanup(
  prisma: PrismaClient,
  input: { type: CleanupType; mode: CleanupMode; confirmText?: string; includeDraftLearningObservations?: boolean }
) {
  if (requiresFullResetConfirmation(input.type, input.confirmText)) {
    throw new Error(`Для полной очистки нужно ввести: ${FULL_VACANCY_RESET_CONFIRM_TEXT}`);
  }

  return prisma.$transaction(async (tx) => {
    const preview = await getCleanupPreview(tx, input.type);
    const vacancyIds = await findCleanupVacancyIds(tx, input.type);

    if (input.type === "old_runs") {
      await deleteOldRuns(tx);
      return { ...preview, message: "Старые завершённые процессы и запуски удалены. Вакансии не затронуты." };
    }

    if (input.type === "full_vacancy_reset") {
      const processRuns = await tx.processRun.findMany({ where: { status: { not: "running" } }, select: { id: true } });
      const searchRuns = await tx.searchRun.findMany({ where: { status: { not: "running" } }, select: { id: true } });
      if (input.includeDraftLearningObservations) {
        await tx.learningObservation.deleteMany({ where: { sourceType: "vacancy", status: "draft" } });
      }
      await tx.application.deleteMany({});
      await tx.coverLetter.deleteMany({});
      await tx.interaction.deleteMany({ where: { vacancyId: { not: null } } });
      await tx.searchRunItem.deleteMany({ where: { searchRunId: { in: searchRuns.map((run) => run.id) } } });
      await tx.searchRun.deleteMany({ where: { id: { in: searchRuns.map((run) => run.id) } } });
      await tx.processRunItem.deleteMany({ where: { processRunId: { in: processRuns.map((run) => run.id) } } });
      await tx.processLog.deleteMany({ where: { processRunId: { in: processRuns.map((run) => run.id) } } });
      await tx.aiCallLog.deleteMany({ where: { OR: [{ vacancyId: { not: null } }, { processRunId: { in: processRuns.map((run) => run.id) } }] } });
      await tx.processRun.deleteMany({ where: { id: { in: processRuns.map((run) => run.id) } } });
      await tx.vacancy.deleteMany({});
      return { ...preview, message: "Вакансии и процессы очищены. Резюме, профили, настройки и принятые правила памяти сохранены." };
    }

    if (input.includeDraftLearningObservations && vacancyIds.length) {
      await tx.learningObservation.deleteMany({ where: { sourceType: "vacancy", sourceId: { in: vacancyIds }, status: "draft" } });
    }

    if (input.mode === "delete") {
      await tx.interaction.deleteMany({ where: { vacancyId: { in: vacancyIds }, type: { startsWith: "bulk_cleanup" } } });
      await tx.searchRunItem.updateMany({ where: { vacancyId: { in: vacancyIds } }, data: { vacancyId: null, status: "deleted_by_cleanup" } });
      await tx.aiCallLog.deleteMany({ where: { vacancyId: { in: vacancyIds } } });
      await tx.vacancy.deleteMany({ where: { id: { in: vacancyIds } } });
      return { ...preview, message: `Физически удалено: ${vacancyIds.length}. Отклики, письма и принятая память не затронуты.` };
    }

    await tx.vacancy.updateMany({ where: { id: { in: vacancyIds } }, data: { status: "archived", isArchived: true } });
    await tx.interaction.createMany({
      data: vacancyIds.map((vacancyId) => ({
        vacancyId,
        type: `bulk_cleanup_${input.type}`,
        occurredAt: new Date(),
        summary: `Вакансия архивирована через безопасную очистку: ${cleanupTypeLabels[input.type] || input.type}.`
      }))
    });

    return { ...preview, message: `Архивировано: ${vacancyIds.length}. Отклики, письма и принятая память не затронуты.` };
  });
}

async function findCleanupVacancyIds(prisma: Db, type: CleanupType) {
  if (type === "old_runs") return [];

  if (type === "full_vacancy_reset") {
    const rows = await prisma.vacancy.findMany({ select: { id: true } });
    return rows.map((row) => row.id);
  }

  const candidates = await prisma.vacancy.findMany({
    where: vacancyWhere(type),
    include: {
      applications: { select: { id: true } },
      coverLetters: { select: { id: true } },
      interactions: { select: { type: true, summary: true } }
    }
  });
  const candidateIds = candidates.filter((vacancy) => !isProtectedVacancyForCleanup(vacancy)).map((vacancy) => vacancy.id);

  if (!candidateIds.length) return [];

  const accepted = await prisma.learningObservation.findMany({
    where: { sourceType: "vacancy", sourceId: { in: candidateIds }, status: "accepted" },
    select: { sourceId: true }
  });
  const protectedByMemory = new Set(accepted.map((row) => row.sourceId).filter(Boolean));
  return candidateIds.filter((id) => !protectedByMemory.has(id));
}

function vacancyWhere(type: CleanupType): Prisma.VacancyWhereInput {
  if (type === "analysis_errors") {
    return { status: "analysis_error", applications: { none: {} }, coverLetters: { none: {} }, skipReasonJson: null };
  }
  if (type === "invalid_sources") {
    return { status: "invalid_source", applications: { none: {} }, coverLetters: { none: {} }, skipReasonJson: null };
  }
  return {
    status: { in: ["found", "needs_review", "analysis_error", "invalid_source", "rejected_by_ai"] },
    applications: { none: {} },
    coverLetters: { none: {} },
    skipReasonJson: null
  };
}

function oldRunWhere(type: CleanupType): Prisma.SearchRunWhereInput {
  if (type === "full_vacancy_reset") return {};
  return { status: { in: ["completed", "error", "stopped", "stale"] } };
}

function oldProcessWhere(type: CleanupType): Prisma.ProcessRunWhereInput {
  if (type === "full_vacancy_reset") return { status: { not: "running" } };
  return { status: { in: ["completed", "error", "stopped", "stale"] } };
}

async function deleteOldRuns(tx: Prisma.TransactionClient) {
  const searchRuns = await tx.searchRun.findMany({ where: oldRunWhere("old_runs"), select: { id: true } });
  const processRuns = await tx.processRun.findMany({ where: oldProcessWhere("old_runs"), select: { id: true } });
  await tx.searchRunItem.deleteMany({ where: { searchRunId: { in: searchRuns.map((run) => run.id) } } });
  await tx.searchRun.deleteMany({ where: { id: { in: searchRuns.map((run) => run.id) } } });
  await tx.processRunItem.deleteMany({ where: { processRunId: { in: processRuns.map((run) => run.id) } } });
  await tx.processLog.deleteMany({ where: { processRunId: { in: processRuns.map((run) => run.id) } } });
  await tx.aiCallLog.deleteMany({ where: { processRunId: { in: processRuns.map((run) => run.id) } } });
  await tx.processRun.deleteMany({ where: { id: { in: processRuns.map((run) => run.id) } } });
}

function previewWarnings(type: CleanupType, acceptedRules: number, draftRules: number) {
  const warnings = ["Резюме, профили поиска, настройки и принятые правила памяти не будут удалены."];
  if (acceptedRules > 0) warnings.push(`Принятые правила памяти сохранены: ${acceptedRules}.`);
  if (draftRules > 0) warnings.push(`Есть черновые наблюдения по этим вакансиям: ${draftRules}. По умолчанию они сохраняются.`);
  if (type === "full_vacancy_reset") warnings.push(`Полная очистка требует подтверждение: ${FULL_VACANCY_RESET_CONFIRM_TEXT}.`);
  return warnings;
}
