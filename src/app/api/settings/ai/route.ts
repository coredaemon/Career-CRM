import { NextResponse } from "next/server";
import { z } from "zod";
import { providerPreset } from "@/lib/ai-presets";
import { getUserSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

function maskKey(key?: string | null) {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

const dualSettingsSchema = z.object({
  analysisProvider: z.string().min(1),
  analysisBaseUrl: z.string().url(),
  analysisApiKey: z.string().optional(),
  analysisModel: z.string().min(1),
  fastModel: z.string().min(1),
  writerProvider: z.string().min(1),
  writerBaseUrl: z.string().url(),
  writerApiKey: z.string().optional(),
  writerModel: z.string().min(1),
  reviewerModel: z.string().min(1)
});

export async function GET() {
  const settings = await getUserSettings();
  const analysisPreset = providerPreset(settings.analysisProvider || "deepseek");
  const writerPreset = providerPreset(settings.writerProvider || "openai");

  return NextResponse.json({
    analysisProvider: settings.analysisProvider || "deepseek",
    analysisBaseUrl: settings.analysisBaseUrl || analysisPreset.baseUrl,
    analysisModel: settings.analysisModel || analysisPreset.defaults.analysis || "",
    fastModel: settings.fastModel || analysisPreset.defaults.fast || "",
    hasAnalysisKey: Boolean(settings.analysisApiKey || settings.aiApiKey),
    analysisKeyMask: maskKey(settings.analysisApiKey || settings.aiApiKey),
    writerProvider: settings.writerProvider || "openai",
    writerBaseUrl: settings.writerBaseUrl || writerPreset.baseUrl,
    writerModel: settings.writerModel || writerPreset.defaults.writer || "",
    reviewerModel: settings.reviewerModel || writerPreset.defaults.reviewer || "",
    hasWriterKey: Boolean(settings.writerApiKey || settings.aiApiKey),
    writerKeyMask: maskKey(settings.writerApiKey || settings.aiApiKey),
    aiConfigured: settings.aiConfigured,
    onboardingCompleted: settings.onboardingCompleted
  });
}

export async function POST(request: Request) {
  try {
    const body = dualSettingsSchema.parse(await request.json());
    const settings = await getUserSettings();

    const updated = await prisma.userSettings.update({
      where: { id: settings.id },
      data: {
        analysisProvider: body.analysisProvider,
        analysisBaseUrl: body.analysisBaseUrl,
        analysisApiKey: body.analysisApiKey || settings.analysisApiKey,
        analysisModel: body.analysisModel,
        fastModel: body.fastModel,
        writerProvider: body.writerProvider,
        writerBaseUrl: body.writerBaseUrl,
        writerApiKey: body.writerApiKey || settings.writerApiKey,
        writerModel: body.writerModel,
        reviewerModel: body.reviewerModel,
        aiConfigured: true,
        aiProvider: body.writerProvider,
        aiBaseUrl: body.writerBaseUrl,
        aiApiKey: body.writerApiKey || settings.writerApiKey || settings.aiApiKey,
        aiPrimaryModel: body.writerModel,
        aiFastModel: body.reviewerModel
      }
    });

    return NextResponse.json({
      ok: true,
      message: "Настройки AI сохранены.",
      hasAnalysisKey: Boolean(updated.analysisApiKey),
      analysisKeyMask: maskKey(updated.analysisApiKey),
      hasWriterKey: Boolean(updated.writerApiKey),
      writerKeyMask: maskKey(updated.writerApiKey)
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Не удалось сохранить настройки AI." },
      { status: 400 }
    );
  }
}
