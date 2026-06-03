import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJsonText } from "@/lib/json";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      resumeId?: string;
      title?: string;
      summary?: string;
      targetRoles?: string[];
      searchQueries?: string[];
      positiveSignals?: string[];
      negativeSignals?: string[];
      stopWords?: string[];
      makeActive?: boolean;
    };

    if (!body.resumeId || !body.title || !body.summary) {
      return NextResponse.json({ ok: false, message: "Выберите резюме и заполните название профиля." }, { status: 400 });
    }

    const profile = await prisma.$transaction(async (tx) => {
      const makeActive = Boolean(body.makeActive);
      if (makeActive) {
        await tx.searchProfile.updateMany({ data: { isActive: false } });
      }

      return tx.searchProfile.create({
        data: {
          resumeId: body.resumeId!,
          title: body.title!,
          summary: body.summary!,
          targetRolesJson: toJsonText(body.targetRoles || []),
          searchQueriesJson: toJsonText(body.searchQueries || []),
          positiveSignalsJson: toJsonText(body.positiveSignals || []),
          negativeSignalsJson: toJsonText(body.negativeSignals || []),
          stopWordsJson: toJsonText(body.stopWords || []),
          status: makeActive ? "active" : "draft",
          isActive: makeActive
        }
      });
    });

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось создать профиль поиска." },
      { status: 400 }
    );
  }
}

