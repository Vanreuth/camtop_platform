-- DropForeignKey
ALTER TABLE "public"."valuation_comparables" DROP CONSTRAINT "valuation_comparables_valuation_id_fkey";

-- AlterTable
ALTER TABLE "public"."valuation_comparables" ADD COLUMN     "salesComparisonValuationSalesComparisonId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."valuation_comparables" ADD CONSTRAINT "valuation_comparables_valuation_id_fkey" FOREIGN KEY ("valuation_id") REFERENCES "public"."property_valuations"("valuation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."valuation_comparables" ADD CONSTRAINT "valuation_comparables_salesComparisonValuationSalesCompari_fkey" FOREIGN KEY ("salesComparisonValuationSalesComparisonId") REFERENCES "public"."sales_comparison_valuations"("sales_comparison_id") ON DELETE SET NULL ON UPDATE CASCADE;
