-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'sin_pago';

-- AlterTable
ALTER TABLE "PaymentMethodConfig" ADD COLUMN     "noPaymentEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "noPaymentInstructions" TEXT,
ADD COLUMN     "noPaymentWhatsapp" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "orderEmailNoteNoPayment" TEXT;

