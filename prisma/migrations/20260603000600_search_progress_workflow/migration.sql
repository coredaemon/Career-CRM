-- AlterTable
ALTER TABLE "SearchRun" ADD COLUMN "stage" TEXT;
ALTER TABLE "SearchRun" ADD COLUMN "currentQuery" TEXT;
ALTER TABLE "SearchRun" ADD COLUMN "currentQueryIndex" INTEGER;
ALTER TABLE "SearchRun" ADD COLUMN "totalQueries" INTEGER;
ALTER TABLE "SearchRun" ADD COLUMN "progressJson" TEXT;
ALTER TABLE "SearchRun" ADD COLUMN "logJson" TEXT;
ALTER TABLE "SearchRun" ADD COLUMN "stopRequested" BOOLEAN NOT NULL DEFAULT false;
