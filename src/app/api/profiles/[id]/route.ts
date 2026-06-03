import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJsonText } from "@/lib/json";
import { pickFallbackActiveProfile } from "@/lib/resume-profile-rules";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      action?: "activate" | "archive" | "unarchive";
      title?: string;
      summary?: string;
      targetRoles?: string[];
      searchQueries?: string[];
      positiveSignals?: string[];
      negativeSignals?: string[];
      stopWords?: string[];
    };

    const profile = await prisma.$transaction(async (tx) => {
      if (body.action === "activate") {
        await tx.searchProfile.updateMany({ data: { isActive: false } });
        return tx.searchProfile.update({
          where: { id },
          data: { isActive: true, status: "active", archivedAt: null }
        });
      }

      if (body.action === "archive") {
        const beforeArchive = await tx.searchProfile.findUniqueOrThrow({ where: { id } });
        const current = await tx.searchProfile.update({
          where: { id },
          data: { isActive: false, status: "archived", archivedAt: new Date() }
        });
        if (beforeArchive.isActive) {
          const fallback = pickFallbackActiveProfile(
            await tx.searchProfile.findMany({ select: { id: true, isActive: true, status: true, archivedAt: true, updatedAt: true, createdAt: true } }),
            id
          );
          if (fallback) await tx.searchProfile.update({ where: { id: fallback.id }, data: { isActive: true, status: "active" } });
        }
        return current;
      }

      if (body.action === "unarchive") {
        return tx.searchProfile.update({
          where: { id },
          data: { status: "draft", archivedAt: null }
        });
      }

      return tx.searchProfile.update({
        where: { id },
        data: {
          title: body.title,
          summary: body.summary,
          targetRolesJson: body.targetRoles ? toJsonText(body.targetRoles) : undefined,
          searchQueriesJson: body.searchQueries ? toJsonText(body.searchQueries) : undefined,
          positiveSignalsJson: body.positiveSignals ? toJsonText(body.positiveSignals) : undefined,
          negativeSignalsJson: body.negativeSignals ? toJsonText(body.negativeSignals) : undefined,
          stopWordsJson: body.stopWords ? toJsonText(body.stopWords) : undefined
        }
      });
    });

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось обновить профиль поиска." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.searchProfile.findUniqueOrThrow({ where: { id } });
      const hasHistory =
        (await tx.vacancy.count({ where: { searchProfileId: id } })) > 0 ||
        (await tx.searchRun.count({ where: { searchProfileId: id } })) > 0;

      if (hasHistory) {
        await tx.searchProfile.update({ where: { id }, data: { isActive: false, status: "archived", archivedAt: new Date() } });
      } else {
        await tx.searchProfile.delete({ where: { id } });
      }

      if (current.isActive) {
        const fallback = pickFallbackActiveProfile(
          await tx.searchProfile.findMany({ select: { id: true, isActive: true, status: true, archivedAt: true, updatedAt: true, createdAt: true } }),
          id
        );
        if (fallback) await tx.searchProfile.update({ where: { id: fallback.id }, data: { isActive: true, status: "active" } });
      }

      return { mode: hasHistory ? "archived" : "deleted" };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось удалить профиль поиска." },
      { status: 400 }
    );
  }
}
