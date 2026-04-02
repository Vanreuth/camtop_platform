/*
  Warnings:

  - You are about to drop the column `construction_type_id` on the `building` table. All the data in the column will be lost.
  - You are about to drop the column `construction_type_id` on the `building_units` table. All the data in the column will be lost.
  - You are about to drop the `construction_types` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `building_id` to the `building_units` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('SALE', 'RENTAL', 'SOLD', 'RENTED', 'SALE_RENTAL', 'CANCELED_TRANSACTION');

-- CreateEnum
CREATE TYPE "public"."BuildingUnitType" AS ENUM ('APARTMENT', 'DUPLEX', 'PENTHOUSE', 'STUDIO', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'FACTORY_SECTION', 'SHOP_HOUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."FacingDirection" AS ENUM ('NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTHEAST', 'NORTHWEST', 'SOUTHEAST', 'SOUTHWEST');

-- DropForeignKey
ALTER TABLE "public"."building" DROP CONSTRAINT "building_construction_type_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."building_units" DROP CONSTRAINT "building_units_construction_type_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."construction_types" DROP CONSTRAINT "construction_types_property_type_id_fkey";

-- DropIndex
DROP INDEX "public"."building_construction_type_id_idx";

-- DropIndex
DROP INDEX "public"."building_units_construction_type_id_idx";

-- AlterTable
ALTER TABLE "public"."building" DROP COLUMN "construction_type_id",
ADD COLUMN     "building_name" VARCHAR(255),
ADD COLUMN     "total_units" INTEGER;

-- AlterTable
ALTER TABLE "public"."building_units" DROP COLUMN "construction_type_id",
ADD COLUMN     "buildingBuildingId" INTEGER,
ADD COLUMN     "building_id" INTEGER NOT NULL,
ADD COLUMN     "has_kitchen" BOOLEAN DEFAULT true,
ADD COLUMN     "has_living_room" BOOLEAN DEFAULT true,
ADD COLUMN     "has_parking_space" BOOLEAN DEFAULT true,
ADD COLUMN     "total_area_sqm" DECIMAL(12,2),
ADD COLUMN     "unitType" "public"."BuildingUnitType";

-- DropTable
DROP TABLE "public"."construction_types";

-- CreateTable
CREATE TABLE "public"."transactions" (
    "transaction_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "valuation_id" INTEGER,
    "transaction_type" "public"."TransactionType" NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "parties_involved" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_valuation_id_key" ON "public"."transactions"("valuation_id");

-- CreateIndex
CREATE INDEX "transactions_property_id_idx" ON "public"."transactions"("property_id");

-- CreateIndex
CREATE INDEX "transactions_transaction_type_idx" ON "public"."transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "building_property_id_idx" ON "public"."building"("property_id");

-- CreateIndex
CREATE INDEX "building_units_building_id_idx" ON "public"."building_units"("building_id");

-- CreateIndex
CREATE INDEX "building_units_property_id_idx" ON "public"."building_units"("property_id");

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_valuation_id_fkey" FOREIGN KEY ("valuation_id") REFERENCES "public"."property_valuations"("valuation_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."building_units" ADD CONSTRAINT "building_units_buildingBuildingId_fkey" FOREIGN KEY ("buildingBuildingId") REFERENCES "public"."building"("building_id") ON DELETE SET NULL ON UPDATE CASCADE;
