-- Add safe resume and search profile lifecycle fields.
ALTER TABLE "Resume" ADD COLUMN "aiSummaryStale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Resume" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Resume" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Resume" ADD COLUMN "archivedAt" DATETIME;

ALTER TABLE "SearchProfile" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SearchProfile" ADD COLUMN "archivedAt" DATETIME;

