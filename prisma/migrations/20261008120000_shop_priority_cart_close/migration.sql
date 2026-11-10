-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "cartAutoCloseSeconds" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "shopPriorityCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

