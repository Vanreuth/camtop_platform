/*
  Warnings:

  - The values [RETAIL,WAREHOUSE,FACTORY_SECTION,SHOP_HOUSE] on the enum `BuildingUnitType` will be removed. If these variants are still used in the database, this will fail.
  - The values [PENDING_VERIFICATION] on the enum `ComparableStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [MODERATE,WELL_MAINTENANCE,POOR_MAINTENANCE] on the enum `Physical_condition` will be removed. If these variants are still used in the database, this will fail.
  - The values [VALUATION_REPORT] on the enum `ReportTypeEnum` will be removed. If these variants are still used in the database, this will fail.
  - The values [HYBRID_APPROACH,RESIDUAL_METHOD] on the enum `ValuationMethod` will be removed. If these variants are still used in the database, this will fail.
  - The values [NONE] on the enum `ViewType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `percentageOfConstruction` on the `building` table. All the data in the column will be lost.
  - You are about to drop the column `managementFee` on the `building_units` table. All the data in the column will be lost.
  - You are about to drop the column `confidence_level` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `final_value` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `list_price` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `valuated_by` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `valuer_company` on the `property_valuations` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[valuation_no]` on the table `property_valuations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[latest_document_id]` on the table `property_valuations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `valuation_no` to the `property_valuations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."BuildingUnitType_new" AS ENUM ('APARTMENT', 'CONDOMINIU', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'OFFICE', 'RETAIL_UNIT', 'SHOPHOUSE', 'OTHER');
ALTER TABLE "public"."building_units" ALTER COLUMN "unitType" TYPE "public"."BuildingUnitType_new" USING ("unitType"::text::"public"."BuildingUnitType_new");
ALTER TYPE "public"."BuildingUnitType" RENAME TO "BuildingUnitType_old";
ALTER TYPE "public"."BuildingUnitType_new" RENAME TO "BuildingUnitType";
DROP TYPE "public"."BuildingUnitType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ComparableStatus_new" AS ENUM ('ACTIVE', 'INACTIVE', 'VERIFIED', 'PENDING');
ALTER TABLE "public"."comparables" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."comparables" ALTER COLUMN "status" TYPE "public"."ComparableStatus_new" USING ("status"::text::"public"."ComparableStatus_new");
ALTER TYPE "public"."ComparableStatus" RENAME TO "ComparableStatus_old";
ALTER TYPE "public"."ComparableStatus_new" RENAME TO "ComparableStatus";
DROP TYPE "public"."ComparableStatus_old";
ALTER TABLE "public"."comparables" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."Physical_condition_new" AS ENUM ('POOR', 'FAIR', 'GOOD', 'EXCELLENT');
ALTER TABLE "public"."building_units" ALTER COLUMN "physical_condition" TYPE "public"."Physical_condition_new" USING ("physical_condition"::text::"public"."Physical_condition_new");
ALTER TYPE "public"."Physical_condition" RENAME TO "Physical_condition_old";
ALTER TYPE "public"."Physical_condition_new" RENAME TO "Physical_condition";
DROP TYPE "public"."Physical_condition_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PropertyStatus" ADD VALUE 'RENTAL_SALE';
ALTER TYPE "public"."PropertyStatus" ADD VALUE 'APPROVED';
ALTER TYPE "public"."PropertyStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "public"."PropertyStatus" ADD VALUE 'REJECTED';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ReportTypeEnum_new" AS ENUM ('VALUATION', 'PROPERTY_LISTING', 'AUDIT_LOG', 'USER_ACTIVITY');
ALTER TABLE "public"."generated_reports" ALTER COLUMN "report_type" TYPE "public"."ReportTypeEnum_new" USING ("report_type"::text::"public"."ReportTypeEnum_new");
ALTER TYPE "public"."ReportTypeEnum" RENAME TO "ReportTypeEnum_old";
ALTER TYPE "public"."ReportTypeEnum_new" RENAME TO "ReportTypeEnum";
DROP TYPE "public"."ReportTypeEnum_old";
COMMIT;

-- AlterEnum
ALTER TYPE "public"."TopographyEnum" ADD VALUE 'NONE';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ValuationMethod_new" AS ENUM ('SALES_COMPARISON_APPROACH', 'INCOME_APPROACH', 'COST_APPROACH');
ALTER TABLE "public"."property_valuations" ALTER COLUMN "valuation_method" DROP DEFAULT;
ALTER TABLE "public"."property_valuations" ALTER COLUMN "valuation_method" TYPE "public"."ValuationMethod_new" USING ("valuation_method"::text::"public"."ValuationMethod_new");
ALTER TYPE "public"."ValuationMethod" RENAME TO "ValuationMethod_old";
ALTER TYPE "public"."ValuationMethod_new" RENAME TO "ValuationMethod";
DROP TYPE "public"."ValuationMethod_old";
ALTER TABLE "public"."property_valuations" ALTER COLUMN "valuation_method" SET DEFAULT 'SALES_COMPARISON_APPROACH';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ViewType_new" AS ENUM ('CITY_VIEW', 'PARK_VIEW', 'RIVER_VIEW', 'SEA_VIEW', 'MOUNTAIN_VIEW', 'NO_VIEW');
ALTER TABLE "public"."building" ALTER COLUMN "viewType" TYPE "public"."ViewType_new" USING ("viewType"::text::"public"."ViewType_new");
ALTER TABLE "public"."building_units" ALTER COLUMN "viewType" TYPE "public"."ViewType_new" USING ("viewType"::text::"public"."ViewType_new");
ALTER TYPE "public"."ViewType" RENAME TO "ViewType_old";
ALTER TYPE "public"."ViewType_new" RENAME TO "ViewType";
DROP TYPE "public"."ViewType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."property_valuations" DROP CONSTRAINT "property_valuations_valuated_by_fkey";

-- DropIndex
DROP INDEX "public"."property_valuations_valuated_by_idx";

-- AlterTable
ALTER TABLE "public"."agriculture_lands" ADD COLUMN     "price_per_tree" DECIMAL(15,2);

-- AlterTable
ALTER TABLE "public"."building" DROP COLUMN "percentageOfConstruction",
ADD COLUMN     "percentage_of_construction" INTEGER;

-- AlterTable
ALTER TABLE "public"."building_units" DROP COLUMN "managementFee",
ADD COLUMN     "management_fee_value" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."comparables" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "public"."property_valuations" DROP COLUMN "confidence_level",
DROP COLUMN "final_value",
DROP COLUMN "list_price",
DROP COLUMN "notes",
DROP COLUMN "valuated_by",
DROP COLUMN "valuer_company",
ADD COLUMN     "building_value" DECIMAL(15,2),
ADD COLUMN     "date_of_inspection" TIMESTAMP(3),
ADD COLUMN     "date_of_report" TIMESTAMP(3),
ADD COLUMN     "forced_sale_value" DECIMAL(15,2),
ADD COLUMN     "land_value" DECIMAL(15,2),
ADD COLUMN     "latest_document_id" INTEGER,
ADD COLUMN     "market_value" DECIMAL(15,2),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "purpose_of_valuation" TEXT,
ADD COLUMN     "valuation_no" VARCHAR(50) NOT NULL,
ADD COLUMN     "valuer_id" INTEGER;

-- DropEnum
DROP TYPE "public"."ConfidenceLevel";

-- DropEnum
DROP TYPE "public"."ManagementFee";

-- DropEnum
DROP TYPE "public"."PercentageOfConstruction";

-- CreateTable
CREATE TABLE "public"."valuation_documents" (
    "file_id" SERIAL NOT NULL,
    "valuation_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    "file_size" INTEGER NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "uploaded_by" INTEGER,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valuation_documents_pkey" PRIMARY KEY ("file_id")
);

-- CreateIndex
CREATE INDEX "valuation_documents_valuation_id_idx" ON "public"."valuation_documents"("valuation_id");

-- CreateIndex
CREATE INDEX "valuation_documents_is_latest_idx" ON "public"."valuation_documents"("is_latest");

-- CreateIndex
CREATE INDEX "valuation_documents_uploaded_by_idx" ON "public"."valuation_documents"("uploaded_by");

-- CreateIndex
CREATE UNIQUE INDEX "valuation_documents_valuation_id_version_key" ON "public"."valuation_documents"("valuation_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "property_valuations_valuation_no_key" ON "public"."property_valuations"("valuation_no");

-- CreateIndex
CREATE UNIQUE INDEX "property_valuations_latest_document_id_key" ON "public"."property_valuations"("latest_document_id");

-- CreateIndex
CREATE INDEX "property_valuations_valuer_id_idx" ON "public"."property_valuations"("valuer_id");

-- AddForeignKey
ALTER TABLE "public"."property_valuations" ADD CONSTRAINT "property_valuations_latest_document_id_fkey" FOREIGN KEY ("latest_document_id") REFERENCES "public"."valuation_documents"("file_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_valuations" ADD CONSTRAINT "property_valuations_valuer_id_fkey" FOREIGN KEY ("valuer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."valuation_documents" ADD CONSTRAINT "valuation_documents_valuation_id_fkey" FOREIGN KEY ("valuation_id") REFERENCES "public"."property_valuations"("valuation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."valuation_documents" ADD CONSTRAINT "valuation_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
