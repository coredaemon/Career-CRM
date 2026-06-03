import { NextResponse } from "next/server";
import { z } from "zod";
import { toJsonText } from "@/lib/json";
import { getUserSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

const completeSchema = z.object({
  resumeTitle: z.string().trim().min(1),
  resumeText: z.string().trim().min(1),
  analysis: z.object({
    profile_title: z.string(),
    profile_summary: z.string(),
    strengths: z.array(z.string()).default([]),
    possible_directions: z.array(z.string()).default([]),
    target_roles: z.array(z.string()).default([]),
    search_queries: z.array(z.string()).default([]),
    positive_signals: z.array(z.string()).default([]),
    negative_signals: z.array(z.string()).default([]),
    stop_words: z.array(z.string()).default([]),
    warnings: z.array(z.string()).default([])
  }),
  selectedTargetRoles: z.array(z.string()).default([]),
  selectedSearchQueries: z.array(z.string()).default([]),
  profileTitle: z.string().trim().min(1)
});

export async function POST(request: Request) {
  try {
    const body = completeSchema.parse(await request.json());
    const settings = await getUserSettings();

    const result = await prisma.$transaction(async (tx) => {
      const resume = await tx.resume.create({
        data: {
          title: body.resumeTitle,
          sourceType: "text",
          originalText: body.resumeText,
          aiSummary: body.analysis.profile_summary
        }
      });

      const profile = await tx.searchProfile.create({
        data: {
          resumeId: resume.id,
          title: body.profileTitle,
          summary: body.analysis.profile_summary,
          targetRolesJson: toJsonText(body.selectedTargetRoles),
          searchQueriesJson: toJsonText(body.selectedSearchQueries),
          positiveSignalsJson: toJsonText(body.analysis.positive_signals),
          negativeSignalsJson: toJsonText(body.analysis.negative_signals),
          stopWordsJson: toJsonText(body.analysis.stop_words),
          status: "active"
        }
      });

      await tx.userSettings.update({
        where: { id: settings.id },
        data: { onboardingCompleted: true }
      });

      return { resume, profile };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Не удалось сохранить профиль поиска."
      },
      { status: 400 }
    );
  }
}
