-- CreateTable
CREATE TABLE "DiaryCompletion" (
    "id" TEXT NOT NULL,
    "diaryEntryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaryCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiaryCompletion_userId_idx" ON "DiaryCompletion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DiaryCompletion_diaryEntryId_userId_key" ON "DiaryCompletion"("diaryEntryId", "userId");

-- AddForeignKey
ALTER TABLE "DiaryCompletion" ADD CONSTRAINT "DiaryCompletion_diaryEntryId_fkey" FOREIGN KEY ("diaryEntryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryCompletion" ADD CONSTRAINT "DiaryCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
