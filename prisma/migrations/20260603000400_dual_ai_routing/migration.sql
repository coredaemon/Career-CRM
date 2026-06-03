-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "analysisProvider" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "analysisBaseUrl" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "analysisApiKey" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "analysisModel" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "fastModel" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "writerProvider" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "writerBaseUrl" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "writerApiKey" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "writerModel" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "reviewerModel" TEXT;

-- AlterTable
ALTER TABLE "Vacancy" ADD COLUMN "aiMetaJson" TEXT;

-- CreateTable
CREATE TABLE "AiCallLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostUsd" REAL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
