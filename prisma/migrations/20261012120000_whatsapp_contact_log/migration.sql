-- AlterTable
ALTER TABLE "AbandonedCart" ADD COLUMN     "whatsappCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "whatsappSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WaitlistEntry" ADD COLUMN     "whatsappCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "whatsappSentAt" TIMESTAMP(3);

