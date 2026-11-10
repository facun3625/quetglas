-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "aiMonthlyTokenQuota" INTEGER;

-- CreateTable
CREATE TABLE "MonthlyUsage" (
    "month" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MonthlyUsage_pkey" PRIMARY KEY ("month","kind")
);

