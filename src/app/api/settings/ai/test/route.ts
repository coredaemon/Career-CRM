import { NextResponse } from "next/server";
import { testAiConnection } from "@/lib/ai";
import { getUserSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await testAiConnection(body);
    const settings = await getUserSettings();

    await prisma.userSettings.update({
      where: { id: settings.id },
      data: {
        aiProvider: body.aiProvider,
        aiBaseUrl: body.aiBaseUrl,
        aiPrimaryModel: body.aiPrimaryModel,
        aiFastModel: body.aiFastModel,
        aiConfigured: true
      }
    });

    return NextResponse.json({
      ok: true,
      message: "AI настроен.",
      providerResponse: result.content
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Не удалось проверить AI-настройки."
      },
      { status: 400 }
    );
  }
}
