-- CreateEnum
CREATE TYPE "ZipRestrictionType" AS ENUM ('block_sale', 'block_shipping');

-- AlterEnum
ALTER TYPE "DiscountType" ADD VALUE 'free_shipping';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "contactDni" TEXT,
ADD COLUMN     "contactFirstName" TEXT,
ADD COLUMN     "contactLastName" TEXT,
ADD COLUMN     "ocaRegisteredAt" TIMESTAMP(3),
ADD COLUMN     "shippingCode" TEXT,
ADD COLUMN     "shippingData" JSONB,
ADD COLUMN     "shippingName" TEXT,
ADD COLUMN     "trackingCarrier" TEXT,
ADD COLUMN     "trackingNumber" TEXT,
ADD COLUMN     "zipDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "length" DOUBLE PRECISION,
ADD COLUMN     "weight" DOUBLE PRECISION,
ADD COLUMN     "width" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "acordarEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cadeteCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "cadeteEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "freeShippingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "freeShippingThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ocaBranchDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 30,
ADD COLUMN     "ocaCuit" TEXT,
ADD COLUMN     "ocaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ocaFranjaHoraria" TEXT NOT NULL DEFAULT '1',
ADD COLUMN     "ocaNroCliente" TEXT,
ADD COLUMN     "ocaOperativa" TEXT,
ADD COLUMN     "ocaOperativaSucursal" TEXT,
ADD COLUMN     "ocaOriginCity" TEXT,
ADD COLUMN     "ocaOriginContact" TEXT,
ADD COLUMN     "ocaOriginEmail" TEXT,
ADD COLUMN     "ocaOriginFloor" TEXT,
ADD COLUMN     "ocaOriginNumber" TEXT,
ADD COLUMN     "ocaOriginProvince" TEXT,
ADD COLUMN     "ocaOriginStreet" TEXT,
ADD COLUMN     "ocaOriginZipCode" TEXT,
ADD COLUMN     "ocaPassword" TEXT,
ADD COLUMN     "ocaUser" TEXT,
ADD COLUMN     "shippingDefaultDimCm" DOUBLE PRECISION NOT NULL DEFAULT 20,
ADD COLUMN     "shippingDefaultWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "zipDiscountsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "zipRestrictionsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ZipCodeRestriction" (
    "id" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "type" "ZipRestrictionType" NOT NULL,
    "message" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZipCodeRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZipCodeDiscount" (
    "id" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZipCodeDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "apartment" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZipCodeRestriction_zipCode_type_key" ON "ZipCodeRestriction"("zipCode", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ZipCodeDiscount_zipCode_key" ON "ZipCodeDiscount"("zipCode");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

