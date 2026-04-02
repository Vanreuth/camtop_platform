/*
  Warnings:

  - You are about to drop the column `price` on the `transactions` table. All the data in the column will be lost.
  - Added the required column `total_price` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."transactions" DROP COLUMN "price",
ADD COLUMN     "building_effective_age" INTEGER,
ADD COLUMN     "building_gross_area" DECIMAL(10,2),
ADD COLUMN     "building_useful_life" INTEGER DEFAULT 50,
ADD COLUMN     "construction_percentage" DECIMAL(3,2) DEFAULT 1.0,
ADD COLUMN     "current_building_value" DECIMAL(15,2),
ADD COLUMN     "depreciation_amount" DECIMAL(15,2),
ADD COLUMN     "land_area_sqm" DECIMAL(10,2),
ADD COLUMN     "new_building_cost" DECIMAL(15,2),
ADD COLUMN     "price_per_sqm" DECIMAL(10,2),
ADD COLUMN     "replacement_cost_per_sqm" DECIMAL(10,2),
ADD COLUMN     "residual_land_value" DECIMAL(15,2),
ADD COLUMN     "total_price" DECIMAL(15,2) NOT NULL;
