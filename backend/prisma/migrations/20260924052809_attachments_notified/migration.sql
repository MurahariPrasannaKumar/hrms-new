-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "fileId" TEXT;

-- AlterTable
ALTER TABLE "DiaryEntry" ADD COLUMN     "fileId" TEXT;

-- AlterTable
ALTER TABLE "Notice" ADD COLUMN     "notifiedAt" TIMESTAMP(3);

-- Existing published notices were already announced; avoid re-notifying.
UPDATE "Notice" SET "notifiedAt" = NOW() WHERE "isPublished" = true;
