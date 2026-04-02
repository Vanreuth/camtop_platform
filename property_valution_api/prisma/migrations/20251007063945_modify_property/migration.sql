-- CreateEnum
CREATE TYPE "public"."ValuationMethod" AS ENUM ('COMPARATIVE_APPROACH', 'INCOME_APPROACH', 'COST_APPROACH', 'HYBRID_APPROACH');

-- CreateEnum
CREATE TYPE "public"."ConfidenceLevel" AS ENUM ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "public"."ValuationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "public"."property_valuations" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" INTEGER,
ADD COLUMN     "assessed_value" DECIMAL(15,2),
ADD COLUMN     "building_unit_price" DECIMAL(15,2),
ADD COLUMN     "confidence_level" "public"."ConfidenceLevel" DEFAULT 'MEDIUM',
ADD COLUMN     "forced_sale_value" DECIMAL(15,2),
ADD COLUMN     "insurance_value" DECIMAL(15,2),
ADD COLUMN     "internal_notes" TEXT,
ADD COLUMN     "land_unit_price" DECIMAL(15,2),
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "rental_value" DECIMAL(15,2),
ADD COLUMN     "status" "public"."ValuationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "valid_until" TIMESTAMP(3),
ADD COLUMN     "valuated_by" INTEGER,
ADD COLUMN     "valuation_method" "public"."ValuationMethod" NOT NULL DEFAULT 'COMPARATIVE_APPROACH',
ADD COLUMN     "valuer_company" VARCHAR(255),
ADD COLUMN     "valuer_license" VARCHAR(100);

-- CreateIndex
CREATE INDEX "property_valuations_valuation_date_idx" ON "public"."property_valuations"("valuation_date");

-- CreateIndex
CREATE INDEX "property_valuations_status_idx" ON "public"."property_valuations"("status");

-- CreateIndex
CREATE INDEX "property_valuations_valuated_by_idx" ON "public"."property_valuations"("valuated_by");

-- CreateIndex
CREATE INDEX "property_valuations_approved_by_idx" ON "public"."property_valuations"("approved_by");

-- AddForeignKey
ALTER TABLE "public"."property_valuations" ADD CONSTRAINT "property_valuations_valuated_by_fkey" FOREIGN KEY ("valuated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_valuations" ADD CONSTRAINT "property_valuations_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
