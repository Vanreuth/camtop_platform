/*
  Warnings:

  - You are about to drop the column `cost_estimation_per_sqm` on the `building` table. All the data in the column will be lost.
  - You are about to drop the column `cost_estimation_per_sqm` on the `building_units` table. All the data in the column will be lost.
  - You are about to drop the column `building_effective_age` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `building_gross_area` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `building_useful_life` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `construction_percentage` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `land_area_sqm` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `parties_involved` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `replacement_cost_per_sqm` on the `transactions` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."transactions_valuation_id_key";

-- AlterTable
ALTER TABLE "public"."building" DROP COLUMN "cost_estimation_per_sqm",
ADD COLUMN     "cost_per_sqm" DECIMAL(15,2),
ADD COLUMN     "replacement_cost_per_sqm" DECIMAL(15,2),
ALTER COLUMN "useful_life" SET DEFAULT 50;

-- AlterTable
ALTER TABLE "public"."building_units" DROP COLUMN "cost_estimation_per_sqm",
ADD COLUMN     "cost_per_sqm" DECIMAL(15,2),
ADD COLUMN     "effective_age" INTEGER,
ADD COLUMN     "replacement_cost_per_sqm" DECIMAL(15,2),
ADD COLUMN     "useful_life" INTEGER DEFAULT 50;

-- AlterTable
ALTER TABLE "public"."transactions" DROP COLUMN "building_effective_age",
DROP COLUMN "building_gross_area",
DROP COLUMN "building_useful_life",
DROP COLUMN "construction_percentage",
DROP COLUMN "land_area_sqm",
DROP COLUMN "notes",
DROP COLUMN "parties_involved",
DROP COLUMN "replacement_cost_per_sqm",
ALTER COLUMN "price_per_sqm" SET DATA TYPE DECIMAL(15,2);

-- CreateIndex
CREATE INDEX "transactions_valuation_id_idx" ON "public"."transactions"("valuation_id");
