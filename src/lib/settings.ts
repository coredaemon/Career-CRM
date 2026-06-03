import { prisma } from "@/lib/prisma";

export async function getUserSettings() {
  const existing = await prisma.userSettings.findFirst({
    orderBy: { createdAt: "asc" }
  });

  if (existing) return existing;

  return prisma.userSettings.create({
    data: {
      aiProvider: process.env.AI_PROVIDER || "",
      aiBaseUrl: process.env.AI_BASE_URL || "",
      aiApiKey: process.env.AI_API_KEY || "",
      aiPrimaryModel: process.env.AI_PRIMARY_MODEL || "",
      aiFastModel: process.env.AI_FAST_MODEL || "",
      analysisProvider: process.env.AI_ANALYSIS_PROVIDER || "deepseek",
      analysisBaseUrl: process.env.AI_ANALYSIS_BASE_URL || "https://api.deepseek.com/v1",
      analysisApiKey: process.env.DEEPSEEK_API_KEY || "",
      analysisModel: process.env.AI_ANALYSIS_MODEL || "deepseek-v4-flash",
      fastModel: process.env.AI_FAST_MODEL || "deepseek-v4-flash",
      writerProvider: process.env.AI_WRITER_PROVIDER || "openai",
      writerBaseUrl: process.env.AI_WRITER_BASE_URL || "https://api.openai.com/v1",
      writerApiKey: process.env.OPENAI_API_KEY || "",
      writerModel: process.env.AI_WRITER_MODEL || "gpt-5.4-mini",
      reviewerModel: process.env.AI_REVIEWER_MODEL || "gpt-5.4-mini",
      aiConfigured: false,
      onboardingCompleted: false
    }
  });
}
