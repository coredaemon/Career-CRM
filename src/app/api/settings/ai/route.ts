import { NextResponse } from "next/server";
import { aiSettingsSchema } from "@/lib/ai";
import { getUserSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

function maskKey(key?: string | null) {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

export async function GET() {
  const settings = await getUserSettings();

  return NextResponse.json({
    aiProvider: settings.aiProvider,
    aiBaseUrl: settings.aiBaseUrl,
    aiPrimaryModel: settings.aiPrimaryModel,
    aiFastModel: settings.aiFastModel,
    aiConfigured: settings.aiConfigured,
    hasApiKey: Boolean(settings.aiApiKey),
    apiKeyMask: maskKey(settings.aiApiKey),
    onboardingCompleted: settings.onboardingCompleted
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = aiSettingsSchema.parse(body);
    const settings = await getUserSettings();

    const updated = await prisma.userSettings.update({
      where: { id: settings.id },
      data: {
        aiProvider: parsed.aiProvider,
        aiBaseUrl: parsed.aiBaseUrl,
        aiApiKey: parsed.aiApiKey || settings.aiApiKey,
        aiPrimaryModel: parsed.aiPrimaryModel,
        aiFastModel: parsed.aiFastModel,
        aiConfigured: true
      }
    });

    return NextResponse.json({
      ok: true,
      message: "Настройки AI сохранены.",
      aiProvider: updated.aiProvider,
      aiBaseUrl: updated.aiBaseUrl,
      aiPrimaryModel: updated.aiPrimaryModel,
      aiFastModel: updated.aiFastModel,
      aiConfigured: updated.aiConfigured,
      hasApiKey: Boolean(updated.aiApiKey),
      apiKeyMask: maskKey(updated.aiApiKey)
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось сохранить настройки AI." },
      { status: 400 }
    );
  }
}
