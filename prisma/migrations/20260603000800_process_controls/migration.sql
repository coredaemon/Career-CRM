-- AlterTable
ALTER TABLE "SearchRun" ADD COLUMN "listHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AiCallLog" ADD COLUMN "vacancyId" TEXT;
ALTER TABLE "AiCallLog" ADD COLUMN "processRunId" TEXT;
ALTER TABLE "AiCallLog" ADD COLUMN "attemptNumber" INTEGER;
ALTER TABLE "AiCallLog" ADD COLUMN "startedAt" DATETIME;
ALTER TABLE "AiCallLog" ADD COLUMN "finishedAt" DATETIME;
ALTER TABLE "AiCallLog" ADD COLUMN "durationMs" INTEGER;

-- AlterTable
ALTER TABLE "ProcessRun" ADD COLUMN "analysisMode" TEXT;
ALTER TABLE "ProcessRun" ADD COLUMN "stopRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProcessRun" ADD COLUMN "stoppedAt" DATETIME;
ALTER TABLE "ProcessRun" ADD COLUMN "stoppedReason" TEXT;
ALTER TABLE "ProcessRun" ADD COLUMN "listHidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProcessRunItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processRunId" TEXT NOT NULL,
    "vacancyId" TEXT,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "durationMs" INTEGER,
    CONSTRAINT "ProcessRunItem_processRunId_fkey" FOREIGN KEY ("processRunId") REFERENCES "ProcessRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
