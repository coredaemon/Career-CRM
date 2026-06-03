-- AlterTable
ALTER TABLE "Resume" ADD COLUMN "sourceFileName" TEXT;
ALTER TABLE "Resume" ADD COLUMN "confirmedFacts" TEXT;

-- AlterTable
ALTER TABLE "Vacancy" ADD COLUMN "sourceVacancyId" TEXT;
ALTER TABLE "Vacancy" ADD COLUMN "publishedAtText" TEXT;
ALTER TABLE "Vacancy" ADD COLUMN "employerUrl" TEXT;
ALTER TABLE "Vacancy" ADD COLUMN "isArchived" BOOLEAN;

-- CreateTable
CREATE TABLE "SearchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "searchProfileId" TEXT,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "queriesJson" TEXT NOT NULL,
    "totalFound" INTEGER NOT NULL DEFAULT 0,
    "totalCreated" INTEGER NOT NULL DEFAULT 0,
    "totalDuplicates" INTEGER NOT NULL DEFAULT 0,
    "totalAnalyzed" INTEGER NOT NULL DEFAULT 0,
    "totalErrors" INTEGER NOT NULL DEFAULT 0,
    "errorLogJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SearchRun_searchProfileId_fkey" FOREIGN KEY ("searchProfileId") REFERENCES "SearchProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchRunItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "searchRunId" TEXT NOT NULL,
    "vacancyId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchRunItem_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "SearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SearchRunItem_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
