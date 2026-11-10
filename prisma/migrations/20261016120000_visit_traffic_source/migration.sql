-- AlterTable
ALTER TABLE "PageView" ADD COLUMN     "campaign" TEXT,
ADD COLUMN     "channel" TEXT,
ADD COLUMN     "isLanding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referrerHost" TEXT;

-- CreateIndex
CREATE INDEX "PageView_isLanding_createdAt_idx" ON "PageView"("isLanding", "createdAt");

