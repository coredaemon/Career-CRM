import { prisma } from "@/lib/prisma";
import { isStale, STALE_AFTER_MS } from "@/lib/process-status";

export { STALE_AFTER_MS, isStale };

export async function markStaleSearchRuns() {
  const threshold = new Date(Date.now() - STALE_AFTER_MS);
  const result = await prisma.searchRun.updateMany({
    where: {
      status: "running",
      updatedAt: { lt: threshold }
    },
    data: {
      status: "stale",
      stage: "stale",
      errorMessage: "Процесс не обновлялся более 10 минут и помечен как зависший."
    }
  });
  return result.count;
}

export async function markStaleProcessRuns() {
  const threshold = new Date(Date.now() - STALE_AFTER_MS);
  const result = await prisma.processRun.updateMany({
    where: {
      status: "running",
      updatedAt: { lt: threshold }
    },
    data: {
      status: "stale",
      currentStep: "stale",
      errorMessage: "Процесс не обновлялся более 10 минут и помечен как зависший."
    }
  });
  return result.count;
}

export async function markAllStaleProcesses() {
  const [searchRuns, processRuns] = await Promise.all([markStaleSearchRuns(), markStaleProcessRuns()]);
  return { searchRuns, processRuns };
}
