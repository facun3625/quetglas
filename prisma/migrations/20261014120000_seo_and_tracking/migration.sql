-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "customHeadCode" TEXT,
ADD COLUMN     "facebookDomainVerification" TEXT,
ADD COLUMN     "gaMeasurementId" TEXT,
ADD COLUMN     "googleSiteVerification" TEXT,
ADD COLUMN     "gtmId" TEXT,
ADD COLUMN     "metaPixelId" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoImageUrl" TEXT,
ADD COLUMN     "seoIndexable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "seoTitle" TEXT;

