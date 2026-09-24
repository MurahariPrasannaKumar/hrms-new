-- CreateTable
CREATE TABLE "UsageDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "lastBeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageDay_date_idx" ON "UsageDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "UsageDay_userId_date_key" ON "UsageDay"("userId", "date");

-- AddForeignKey
ALTER TABLE "UsageDay" ADD CONSTRAINT "UsageDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
