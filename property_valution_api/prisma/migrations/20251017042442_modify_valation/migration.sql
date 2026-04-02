/*
  Warnings:

  - You are about to drop the column `assessed_value` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `building_unit_price` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `fair_value` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `forced_sale_value` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `insurance_value` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `investment_value` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `land_unit_price` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `market_value` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `rental_value` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `valid_until` on the `property_valuations` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."ComparableStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'VERIFIED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "public"."AdjustmentType" AS ENUM ('LOCATION', 'SIZE', 'CONDITION', 'AMENITIES', 'TIME', 'OTHER');

-- AlterEnum
ALTER TYPE "public"."ValuationMethod" ADD VALUE 'RESIDUAL_METHOD';

-- DropForeignKey
ALTER TABLE "public"."generated_reports" DROP CONSTRAINT "generated_reports_generated_by_fkey";

-- AlterTable
ALTER TABLE "public"."generated_reports" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "public"."property_valuations" DROP COLUMN "assessed_value",
DROP COLUMN "building_unit_price",
DROP COLUMN "fair_value",
DROP COLUMN "forced_sale_value",
DROP COLUMN "insurance_value",
DROP COLUMN "investment_value",
DROP COLUMN "land_unit_price",
DROP COLUMN "market_value",
DROP COLUMN "rental_value",
DROP COLUMN "valid_until",
ADD COLUMN     "comparableComparableId" INTEGER,
ADD COLUMN     "final_value" DECIMAL(15,2);

-- DropEnum
DROP TYPE "public"."FacingDirection";

-- CreateTable
CREATE TABLE "public"."comparables" (
    "comparable_id" SERIAL NOT NULL,
    "property_id" INTEGER,
    "address" VARCHAR(255) NOT NULL,
    "property_type_id" INTEGER NOT NULL,
    "property_subtype_id" INTEGER,
    "land_area_sqm" DECIMAL(12,2),
    "building_area_sqm" DECIMAL(12,2),
    "sale_price" DECIMAL(15,2),
    "sale_date" TIMESTAMP(3),
    "transaction_type" "public"."TransactionType",
    "price_per_sqm_land" DECIMAL(15,2),
    "price_per_sqm_building" DECIMAL(15,2),
    "year_built" INTEGER,
    "number_of_storeys" INTEGER,
    "number_of_rooms" INTEGER,
    "number_of_baths" INTEGER,
    "condition" VARCHAR(100),
    "province_id" INTEGER,
    "district_id" INTEGER,
    "commune_id" INTEGER,
    "village_id" INTEGER,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "status" "public"."ComparableStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "data_source" VARCHAR(100),
    "verified_by" INTEGER,
    "verified_at" TIMESTAMP(3),
    "amenities" JSONB,
    "features" JSONB,
    "markertConditions" JSONB,
    "notes" TEXT,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comparables_pkey" PRIMARY KEY ("comparable_id")
);

-- CreateTable
CREATE TABLE "public"."valuation_comparables" (
    "id" SERIAL NOT NULL,
    "valuation_id" INTEGER NOT NULL,
    "comparable_id" INTEGER NOT NULL,
    "selection_reason" TEXT,
    "weight" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "adjusted_price" DECIMAL(15,2) NOT NULL,
    "total_adjustment" DECIMAL(15,2) NOT NULL,
    "total_adjustment_percent" DECIMAL(5,2) NOT NULL,
    "distance_km" DECIMAL(8,2),
    "similarity_score" DECIMAL(5,2),
    "rank" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "valuation_comparables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."comparable_adjustments" (
    "adjustment_id" SERIAL NOT NULL,
    "valuation_comparable_id" INTEGER,
    "comparable_id" INTEGER NOT NULL,
    "adjustment_type" "public"."AdjustmentType" NOT NULL,
    "adjustment_factor" VARCHAR(100) NOT NULL,
    "adjustment_amount" DECIMAL(15,2) NOT NULL,
    "adjustment_percent" DECIMAL(5,2) NOT NULL,
    "subject_value" VARCHAR(255),
    "comparable_value" VARCHAR(255),
    "reasoning" TEXT,
    "methodology" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparable_adjustments_pkey" PRIMARY KEY ("adjustment_id")
);

-- CreateTable
CREATE TABLE "public"."sales_comparison_valuations" (
    "sales_comparison_id" SERIAL NOT NULL,
    "valuation_id" INTEGER NOT NULL,
    "market_value" DECIMAL(15,2),
    "land_unit_price" DECIMAL(15,2),
    "building_unit_price" DECIMAL(15,2),
    "comparables_used" INTEGER NOT NULL,
    "average_adjustment" DECIMAL(5,2) NOT NULL,
    "adjustment_range" VARCHAR(100),
    "weighting_method" VARCHAR(100),
    "comparables_quality" VARCHAR(100),
    "data_reliability" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_comparison_valuations_pkey" PRIMARY KEY ("sales_comparison_id")
);

-- CreateTable
CREATE TABLE "public"."income_approach_valuations" (
    "income_approach_id" SERIAL NOT NULL,
    "valuation_id" INTEGER NOT NULL,
    "investmentValue" DECIMAL(15,2) NOT NULL,
    "monthlyRent" DECIMAL(15,2) NOT NULL,
    "annual_gross_income" DECIMAL(15,2) NOT NULL,
    "effective_gross_income" DECIMAL(15,2) NOT NULL,
    "net_operating_income" DECIMAL(15,2) NOT NULL,
    "vacancy_loss" DECIMAL(15,2) NOT NULL,
    "vacancy_rate" DECIMAL(5,2) NOT NULL,
    "total_operating_expenses" DECIMAL(15,2) NOT NULL,
    "management_fees" DECIMAL(15,2) NOT NULL,
    "maintenance_costs" DECIMAL(15,2) NOT NULL,
    "property_tax" DECIMAL(15,2) NOT NULL,
    "insurance" DECIMAL(15,2) NOT NULL,
    "utilities" DECIMAL(15,2),
    "other_expenses" DECIMAL(15,2),
    "capitalization_rate" DECIMAL(5,2) NOT NULL,
    "operating_expense_ratio" DECIMAL(5,2) NOT NULL,
    "gross_rent_multiplier" DECIMAL(10,2) NOT NULL,
    "cash_on_cash_return" DECIMAL(5,2),
    "income_breakdown" JSONB,
    "expense_breakdown" JSONB,
    "cap_rate_source" VARCHAR(255),
    "vacancy_rate_justification" TEXT,
    "expense_assumptions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "income_approach_valuations_pkey" PRIMARY KEY ("income_approach_id")
);

-- CreateTable
CREATE TABLE "public"."cost_approach_valuations" (
    "cost_approach_id" SERIAL NOT NULL,
    "valuation_id" INTEGER NOT NULL,
    "fair_value" DECIMAL(15,2) NOT NULL,
    "land_value" DECIMAL(15,2) NOT NULL,
    "land_area_sqm" DECIMAL(10,2) NOT NULL,
    "land_price_per_sqm" DECIMAL(15,2) NOT NULL,
    "building_value" DECIMAL(15,2) NOT NULL,
    "building_area_sqm" DECIMAL(10,2),
    "replacement_cost_new" DECIMAL(15,2) NOT NULL,
    "construction_cost_per_sqm" DECIMAL(15,2) NOT NULL,
    "total_depreciation" DECIMAL(15,2) NOT NULL,
    "total_depreciation_percent" DECIMAL(5,2) NOT NULL,
    "physical_depreciation" DECIMAL(5,2) NOT NULL,
    "physical_depreciation_amount" DECIMAL(15,2) NOT NULL,
    "functional_obsolescence" DECIMAL(5,2) NOT NULL,
    "functional_obsolescence_amount" DECIMAL(15,2) NOT NULL,
    "functional_obsolescence_reason" TEXT,
    "external_obsolescence" DECIMAL(5,2) NOT NULL,
    "external_obsolescence_amount" DECIMAL(15,2) NOT NULL,
    "external_obsolescence_reason" TEXT,
    "construction_year" INTEGER NOT NULL,
    "current_year" INTEGER NOT NULL,
    "actual_age" INTEGER NOT NULL,
    "effective_age" INTEGER NOT NULL,
    "economic_life" INTEGER NOT NULL,
    "remaining_life" INTEGER NOT NULL,
    "building_type" VARCHAR(100),
    "construction_quality" VARCHAR(20),
    "building_condition" VARCHAR(50),
    "cost_breakdown" JSONB,
    "depreciation_method" VARCHAR(100),
    "land_value_source" VARCHAR(255),
    "cost_estimate_source" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_approach_valuations_pkey" PRIMARY KEY ("cost_approach_id")
);

-- CreateIndex
CREATE INDEX "comparables_status_idx" ON "public"."comparables"("status");

-- CreateIndex
CREATE INDEX "comparables_verified_by_idx" ON "public"."comparables"("verified_by");

-- CreateIndex
CREATE INDEX "valuation_comparables_valuation_id_idx" ON "public"."valuation_comparables"("valuation_id");

-- CreateIndex
CREATE INDEX "valuation_comparables_comparable_id_idx" ON "public"."valuation_comparables"("comparable_id");

-- CreateIndex
CREATE UNIQUE INDEX "valuation_comparables_valuation_id_comparable_id_key" ON "public"."valuation_comparables"("valuation_id", "comparable_id");

-- CreateIndex
CREATE INDEX "comparable_adjustments_valuation_comparable_id_idx" ON "public"."comparable_adjustments"("valuation_comparable_id");

-- CreateIndex
CREATE INDEX "comparable_adjustments_comparable_id_idx" ON "public"."comparable_adjustments"("comparable_id");

-- CreateIndex
CREATE INDEX "comparable_adjustments_adjustment_type_idx" ON "public"."comparable_adjustments"("adjustment_type");

-- CreateIndex
CREATE UNIQUE INDEX "sales_comparison_valuations_valuation_id_key" ON "public"."sales_comparison_valuations"("valuation_id");

-- CreateIndex
CREATE UNIQUE INDEX "income_approach_valuations_valuation_id_key" ON "public"."income_approach_valuations"("valuation_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_approach_valuations_valuation_id_key" ON "public"."cost_approach_valuations"("valuation_id");

-- CreateIndex
CREATE INDEX "property_valuations_valuation_method_idx" ON "public"."property_valuations"("valuation_method");

-- CreateIndex
CREATE INDEX "transactions_transaction_date_idx" ON "public"."transactions"("transaction_date");

-- AddForeignKey
ALTER TABLE "public"."comparables" ADD CONSTRAINT "comparables_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comparables" ADD CONSTRAINT "comparables_property_type_id_fkey" FOREIGN KEY ("property_type_id") REFERENCES "public"."property_types"("property_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comparables" ADD CONSTRAINT "comparables_property_subtype_id_fkey" FOREIGN KEY ("property_subtype_id") REFERENCES "public"."property_subtypes"("property_subtype_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comparables" ADD CONSTRAINT "comparables_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comparables" ADD CONSTRAINT "comparables_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."valuation_comparables" ADD CONSTRAINT "valuation_comparables_valuation_id_fkey" FOREIGN KEY ("valuation_id") REFERENCES "public"."sales_comparison_valuations"("sales_comparison_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."valuation_comparables" ADD CONSTRAINT "valuation_comparables_comparable_id_fkey" FOREIGN KEY ("comparable_id") REFERENCES "public"."comparables"("comparable_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comparable_adjustments" ADD CONSTRAINT "comparable_adjustments_valuation_comparable_id_fkey" FOREIGN KEY ("valuation_comparable_id") REFERENCES "public"."valuation_comparables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comparable_adjustments" ADD CONSTRAINT "comparable_adjustments_comparable_id_fkey" FOREIGN KEY ("comparable_id") REFERENCES "public"."comparables"("comparable_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_valuations" ADD CONSTRAINT "property_valuations_comparableComparableId_fkey" FOREIGN KEY ("comparableComparableId") REFERENCES "public"."comparables"("comparable_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_comparison_valuations" ADD CONSTRAINT "sales_comparison_valuations_valuation_id_fkey" FOREIGN KEY ("valuation_id") REFERENCES "public"."property_valuations"("valuation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."income_approach_valuations" ADD CONSTRAINT "income_approach_valuations_valuation_id_fkey" FOREIGN KEY ("valuation_id") REFERENCES "public"."property_valuations"("valuation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cost_approach_valuations" ADD CONSTRAINT "cost_approach_valuations_valuation_id_fkey" FOREIGN KEY ("valuation_id") REFERENCES "public"."property_valuations"("valuation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."generated_reports" ADD CONSTRAINT "generated_reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."generated_reports" ADD CONSTRAINT "generated_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
