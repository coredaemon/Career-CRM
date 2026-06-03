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
      aiPrimaryModel: process.env.AI_PRIMARY_MODEL || "",
      aiFastModel: process.env.AI_FAST_MODEL || "",
      aiConfigured: false,
      onboardingCompleted: false
    }
  });
}
