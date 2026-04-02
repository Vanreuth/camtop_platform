-- DropForeignKey
ALTER TABLE "public"."building_units" DROP CONSTRAINT "building_units_building_id_fkey";

-- AlterTable
ALTER TABLE "public"."building_units" ALTER COLUMN "building_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."building_units" ADD CONSTRAINT "building_units_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "public"."building"("building_id") ON DELETE SET NULL ON UPDATE CASCADE;
