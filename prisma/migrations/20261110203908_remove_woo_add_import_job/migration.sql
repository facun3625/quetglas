/*
  Warnings:

  - You are about to drop the column `wooId` on the `Attribute` table. All the data in the column will be lost.
  - You are about to drop the column `wooId` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `wooId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `wooId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `wooId` on the `Variant` table. All the data in the column will be lost.
  - You are about to drop the `MigrationJob` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('running', 'done', 'failed', 'cancelled');

-- DropIndex
DROP INDEX "Attribute_wooId_key";

-- DropIndex
DROP INDEX "Category_wooId_key";

-- DropIndex
DROP INDEX "Product_wooId_key";

-- DropIndex
DROP INDEX "User_wooId_key";

-- DropIndex
DROP INDEX "Variant_wooId_key";

-- AlterTable
ALTER TABLE "Attribute" DROP COLUMN "wooId";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "wooId";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "wooId";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "wooId";

-- AlterTable
ALTER TABLE "Variant" DROP COLUMN "wooId";

-- DropTable
DROP TABLE "MigrationJob";

-- DropEnum
DROP TYPE "MigrationStatus";

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'running',
    "progress" JSONB NOT NULL DEFAULT '{}',
    "counters" JSONB NOT NULL DEFAULT '{}',
    "issues" JSONB NOT NULL DEFAULT '[]',
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);
