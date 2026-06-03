import { NextResponse } from "next/server";
import { aiSettingsSchema } from "@/lib/ai";
import { getUserSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const settings = await getUserSettings();

  return NextResponse.json({
    aiProvider: settings.aiProvider,
    aiBaseUrl: settings.aiBaseUrl,
    aiPrimaryModel: settings.aiPrimaryModel,
    aiFastModel: settings.aiFastModel,
    aiConfigured: settings.aiConfigured,
    onboardingCompleted: settings.onboardingCompleted
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = aiSettingsSchema.omit({ aiApiKey: true }).parse(body);
  const settings = await getUserSettings();

  const updated = await prisma.userSettings.update({
    where: { id: settings.id },
    data: {
      aiProvider: parsed.aiProvider,
      aiBaseUrl: parsed.aiBaseUrl,
      aiPrimaryModel: parsed.aiPrimaryModel,
      aiFastModel: parsed.aiFastModel
    }
  });

  return NextResponse.json({
    aiProvider: updated.aiProvider,
    aiBaseUrl: updated.aiBaseUrl,
    aiPrimaryModel: updated.aiPrimaryModel,
    aiFastModel: updated.aiFastModel,
    aiConfigured: updated.aiConfigured
  });
}
