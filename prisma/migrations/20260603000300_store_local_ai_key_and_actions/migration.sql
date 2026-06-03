-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "aiApiKey" TEXT;

-- AlterTable
ALTER TABLE "Vacancy" ADD COLUMN "nextActionType" TEXT;
ALTER TABLE "Vacancy" ADD COLUMN "nextActionAt" DATETIME;
ALTER TABLE "Vacancy" ADD COLUMN "nextActionNote" TEXT;
ALTER TABLE "Vacancy" ADD COLUMN "testRequired" BOOLEAN;
ALTER TABLE "Vacancy" ADD COLUMN "testStatus" TEXT;
ALTER TABLE "Vacancy" ADD COLUMN "testLink" TEXT;
ALTER TABLE "Vacancy" ADD COLUMN "testNotes" TEXT;
ALTER TABLE "Vacancy" ADD COLUMN "testCompletedAt" DATETIME;
