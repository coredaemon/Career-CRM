-- AlterTable Vacancy
ALTER TABLE "Vacancy" ADD COLUMN "analysisErrorCode" TEXT;
ALTER TABLE "Vacancy" ADD COLUMN "analysisErrorMessage" TEXT;

-- AlterTable SearchRun
ALTER TABLE "SearchRun" ADD COLUMN "totalRecommended" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SearchRun" ADD COLUMN "totalAnalysisErrors" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SearchRun" ADD COLUMN "totalCoverLetters" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SearchRun" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "SearchRun" ADD COLUMN "errorMessage" TEXT;

-- AlterTable SearchRunItem
ALTER TABLE "SearchRunItem" ADD COLUMN "errorCode" TEXT;

-- AlterTable AiCallLog
ALTER TABLE "AiCallLog" ADD COLUMN "errorCode" TEXT;

-- CreateTable ProcessRun
CREATE TABLE "ProcessRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "progressCurrent" INTEGER NOT NULL DEFAULT 0,
    "progressTotal" INTEGER NOT NULL DEFAULT 0,
    "progressPercent" INTEGER,
    "currentStep" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "resultJson" TEXT,
    "metadataJson" TEXT
);

-- CreateTable ProcessLog
CREATE TABLE "ProcessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processRunId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detailsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessLog_processRunId_fkey" FOREIGN KEY ("processRunId") REFERENCES "ProcessRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
