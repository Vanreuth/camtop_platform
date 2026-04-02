/*
  Warnings:

  - The `unitType` column on the `building_units` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('STUDIO', 'ONE_BEDROOM', 'TWO_BEDROOM', 'THREE_BEDROOM', 'PENTHOUSE', 'DUPLEX', 'APARTMENT', 'OFFICE', 'RETAIL', 'SHOWROOM', 'MIXED_USE', 'WAREHOUSE', 'FACTORY', 'STORAGE');

-- AlterTable
ALTER TABLE "building_units" ADD COLUMN     "property_type_id" INTEGER,
DROP COLUMN "unitType",
ADD COLUMN     "unitType" "UnitType";

-- DropEnum
DROP TYPE "BuildingUnitType";

-- CreateIndex
CREATE INDEX "building_units_property_type_id_idx" ON "building_units"("property_type_id");

-- AddForeignKey
ALTER TABLE "building_units" ADD CONSTRAINT "building_units_property_type_id_fkey" FOREIGN KEY ("property_type_id") REFERENCES "property_types"("property_type_id") ON DELETE SET NULL ON UPDATE CASCADE;
