-- AlterTable
ALTER TABLE "AbandonedCart" ADD COLUMN     "recoveryEmailSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "cartRecoveryDelayHours" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "cartRecoveryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cartRecoveryMessage" TEXT,
ADD COLUMN     "cartRecoverySubject" TEXT;

-- CreateTable
CREATE TABLE "CartRecoveryOptOut" (
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartRecoveryOptOut_pkey" PRIMARY KEY ("email")
);

