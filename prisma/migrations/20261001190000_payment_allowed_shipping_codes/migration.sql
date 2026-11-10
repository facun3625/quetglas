-- AlterTable
ALTER TABLE "PaymentMethodConfig" ADD COLUMN     "allowedShippingCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

