-- AlterTable
ALTER TABLE "LearningResource" ADD COLUMN     "classId" TEXT,
ADD COLUMN     "uploadedById" TEXT;

-- CreateIndex
CREATE INDEX "LearningResource_classId_idx" ON "LearningResource"("classId");

-- AddForeignKey
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
