/*
  Warnings:

  - The values [VERY_LOW,VERY_HIGH] on the enum `ConfidenceLevel` will be removed. If these variants are still used in the database, this will fail.
  - The values [COMPARATIVE_APPROACH] on the enum `ValuationMethod` will be removed. If these variants are still used in the database, this will fail.
  - The values [EXPIRED] on the enum `ValuationStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."ReportTypeEnum" AS ENUM ('VALUATION_REPORT', 'PROPERTY_LISTING', 'AUDIT_LOG', 'USER_ACTIVITY');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ConfidenceLevel_new" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
ALTER TABLE "public"."property_valuations" ALTER COLUMN "confidence_level" DROP DEFAULT;
ALTER TABLE "public"."property_valuations" ALTER COLUMN "confidence_level" TYPE "public"."ConfidenceLevel_new" USING ("confidence_level"::text::"public"."ConfidenceLevel_new");
ALTER TYPE "public"."ConfidenceLevel" RENAME TO "ConfidenceLevel_old";
ALTER TYPE "public"."ConfidenceLevel_new" RENAME TO "ConfidenceLevel";
DROP TYPE "public"."ConfidenceLevel_old";
ALTER TABLE "public"."property_valuations" ALTER COLUMN "confidence_level" SET DEFAULT 'MEDIUM';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ValuationMethod_new" AS ENUM ('SALES_COMPARISON_APPROACH', 'INCOME_APPROACH', 'COST_APPROACH', 'HYBRID_APPROACH');
ALTER TABLE "public"."property_valuations" ALTER COLUMN "valuation_method" DROP DEFAULT;
ALTER TABLE "public"."property_valuations" ALTER COLUMN "valuation_method" TYPE "public"."ValuationMethod_new" USING ("valuation_method"::text::"public"."ValuationMethod_new");
ALTER TYPE "public"."ValuationMethod" RENAME TO "ValuationMethod_old";
ALTER TYPE "public"."ValuationMethod_new" RENAME TO "ValuationMethod";
DROP TYPE "public"."ValuationMethod_old";
ALTER TABLE "public"."property_valuations" ALTER COLUMN "valuation_method" SET DEFAULT 'SALES_COMPARISON_APPROACH';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."ValuationStatus_new" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');
ALTER TABLE "public"."property_valuations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."property_valuations" ALTER COLUMN "status" TYPE "public"."ValuationStatus_new" USING ("status"::text::"public"."ValuationStatus_new");
ALTER TYPE "public"."ValuationStatus" RENAME TO "ValuationStatus_old";
ALTER TYPE "public"."ValuationStatus_new" RENAME TO "ValuationStatus";
DROP TYPE "public"."ValuationStatus_old";
ALTER TABLE "public"."property_valuations" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "public"."property_valuations" ADD COLUMN     "fair_value" DECIMAL(15,2),
ADD COLUMN     "investment_value" DECIMAL(15,2),
ALTER COLUMN "valuation_method" SET DEFAULT 'SALES_COMPARISON_APPROACH';

-- CreateTable
CREATE TABLE "public"."generated_reports" (
    "report_id" SERIAL NOT NULL,
    "report_name" VARCHAR(100) NOT NULL,
    "report_type" "public"."ReportTypeEnum" NOT NULL,
    "generated_by" INTEGER NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "report_url" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("report_id")
);

-- CreateIndex
CREATE INDEX "generated_reports_generated_by_idx" ON "public"."generated_reports"("generated_by");

-- AddForeignKey
ALTER TABLE "public"."generated_reports" ADD CONSTRAINT "generated_reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
