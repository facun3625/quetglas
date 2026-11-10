-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "checkoutNotice" TEXT,
ADD COLUMN     "successMessage" TEXT,
ADD COLUMN     "successMessageCash" TEXT,
ADD COLUMN     "successMessageMercadopago" TEXT,
ADD COLUMN     "successMessagePayway" TEXT,
ADD COLUMN     "successMessageTransfer" TEXT,
ADD COLUMN     "successTitle" TEXT;

