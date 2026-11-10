-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "number" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "statusEmailCancelledEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "statusEmailCancelledText" TEXT,
ADD COLUMN     "statusEmailConfirmedEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "statusEmailConfirmedText" TEXT,
ADD COLUMN     "statusEmailDeliveredEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "statusEmailDeliveredText" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

