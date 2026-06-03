import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resumeTextChangePatch, shouldArchiveResumeOnDelete } from "@/lib/resume-profile-rules";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      action?: "activate" | "archive" | "unarchive";
      title?: string;
      originalText?: string;
      aiSummary?: string | null;
      confirmedFacts?: string | null;
    };

    const resume = await prisma.$transaction(async (tx) => {
      if (body.action === "activate") {
        await tx.resume.updateMany({ data: { isActive: false } });
        return tx.resume.update({
          where: { id },
          data: { isActive: true, isArchived: false, archivedAt: null }
        });
      }

      if (body.action === "archive") {
        await tx.searchProfile.updateMany({ where: { resumeId: id }, data: { isActive: false, status: "archived", archivedAt: new Date() } });
        return tx.resume.update({
          where: { id },
          data: { isActive: false, isArchived: true, archivedAt: new Date() }
        });
      }

      if (body.action === "unarchive") {
        return tx.resume.update({
          where: { id },
          data: { isArchived: false, archivedAt: null }
        });
      }

      const current = await tx.resume.findUniqueOrThrow({ where: { id }, select: { originalText: true } });
      const textPatch = typeof body.originalText === "string" ? resumeTextChangePatch(current.originalText, body.originalText) : { changed: false, aiSummaryStale: false };

      return tx.resume.update({
        where: { id },
        data: {
          title: body.title,
          originalText: body.originalText,
          aiSummary: body.aiSummary,
          confirmedFacts: body.confirmedFacts,
          aiSummaryStale: textPatch.changed ? true : undefined
        }
      });
    });

    return NextResponse.json({ ok: true, resume });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось сохранить резюме." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await prisma.$transaction(async (tx) => {
      const counts = {
        searchProfiles: await tx.searchProfile.count({ where: { resumeId: id } }),
        applications: await tx.application.count({ where: { resumeId: id } }),
        coverLetters: await tx.coverLetter.count({ where: { resumeId: id } })
      };

      if (shouldArchiveResumeOnDelete(counts)) {
        await tx.searchProfile.updateMany({ where: { resumeId: id }, data: { isActive: false, status: "archived", archivedAt: new Date() } });
        const resume = await tx.resume.update({
          where: { id },
          data: { isActive: false, isArchived: true, archivedAt: new Date() }
        });
        return { mode: "archived", resume, counts };
      }

      await tx.resume.delete({ where: { id } });
      return { mode: "deleted", counts };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось удалить резюме." },
      { status: 400 }
    );
  }
}
