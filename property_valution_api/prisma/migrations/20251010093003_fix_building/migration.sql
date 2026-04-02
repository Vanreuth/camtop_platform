/*
  Warnings:

  - You are about to drop the column `buildingBuildingId` on the `building_units` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."building_units" DROP CONSTRAINT "building_units_buildingBuildingId_fkey";

-- AlterTable
ALTER TABLE "public"."building_units" DROP COLUMN "buildingBuildingId";

-- AddForeignKey
ALTER TABLE "public"."building_units" ADD CONSTRAINT "building_units_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."building"("building_id") ON DELETE RESTRICT ON UPDATE CASCADE;
