/*
  Warnings:

  - You are about to drop the column `village_id` on the `property_address` table. All the data in the column will be lost.
  - You are about to drop the `villages` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `commune_id` to the `property_address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `district_id` to the `property_address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `province_id` to the `property_address` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."agriculture_lands" DROP CONSTRAINT "agriculture_lands_property_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."building" DROP CONSTRAINT "building_property_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."building_units" DROP CONSTRAINT "building_units_property_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."data_sources" DROP CONSTRAINT "data_sources_property_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."lands" DROP CONSTRAINT "lands_property_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."property_address" DROP CONSTRAINT "property_address_property_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."property_address" DROP CONSTRAINT "property_address_village_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."property_locations" DROP CONSTRAINT "property_locations_property_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."property_photos" DROP CONSTRAINT "property_photos_property_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."title_documents" DROP CONSTRAINT "title_documents_property_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."villages" DROP CONSTRAINT "villages_commune_id_fkey";

-- AlterTable
ALTER TABLE "public"."lands" ADD COLUMN     "waterSource" "public"."WaterSourceEnum";

-- AlterTable
ALTER TABLE "public"."properties" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" INTEGER;

-- AlterTable
ALTER TABLE "public"."property_address" DROP COLUMN "village_id",
ADD COLUMN     "commune_id" INTEGER NOT NULL,
ADD COLUMN     "district_id" INTEGER NOT NULL,
ADD COLUMN     "province_id" INTEGER NOT NULL,
ADD COLUMN     "village_name" VARCHAR(50);

-- DropTable
DROP TABLE "public"."villages";

-- CreateTable
CREATE TABLE "public"."property_valuations" (
    "valuation_id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "list_price" DECIMAL(15,2),
    "market_value" DECIMAL(15,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "valuation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_valuations_pkey" PRIMARY KEY ("valuation_id")
);

-- CreateTable
CREATE TABLE "public"."building_subtypes" (
    "building_subtype_id" SERIAL NOT NULL,
    "subtype_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_subtypes_pkey" PRIMARY KEY ("building_subtype_id")
);

-- CreateIndex
CREATE INDEX "property_valuations_property_id_idx" ON "public"."property_valuations"("property_id");

-- CreateIndex
CREATE INDEX "building_construction_type_id_idx" ON "public"."building"("construction_type_id");

-- CreateIndex
CREATE INDEX "building_building_subtype_id_idx" ON "public"."building"("building_subtype_id");

-- CreateIndex
CREATE INDEX "building_photos_building_id_idx" ON "public"."building_photos"("building_id");

-- CreateIndex
CREATE INDEX "building_units_construction_type_id_idx" ON "public"."building_units"("construction_type_id");

-- CreateIndex
CREATE INDEX "communes_district_id_idx" ON "public"."communes"("district_id");

-- CreateIndex
CREATE INDEX "districts_province_id_idx" ON "public"."districts"("province_id");

-- CreateIndex
CREATE INDEX "properties_property_type_id_idx" ON "public"."properties"("property_type_id");

-- CreateIndex
CREATE INDEX "properties_use_id_idx" ON "public"."properties"("use_id");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "public"."properties"("status");

-- CreateIndex
CREATE INDEX "properties_created_by_idx" ON "public"."properties"("created_by");

-- CreateIndex
CREATE INDEX "properties_deleted_at_idx" ON "public"."properties"("deleted_at");

-- CreateIndex
CREATE INDEX "property_address_province_id_idx" ON "public"."property_address"("province_id");

-- CreateIndex
CREATE INDEX "property_address_district_id_idx" ON "public"."property_address"("district_id");

-- CreateIndex
CREATE INDEX "property_address_commune_id_idx" ON "public"."property_address"("commune_id");

-- AddForeignKey
ALTER TABLE "public"."property_valuations" ADD CONSTRAINT "property_valuations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."title_documents" ADD CONSTRAINT "title_documents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."data_sources" ADD CONSTRAINT "data_sources_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_photos" ADD CONSTRAINT "property_photos_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lands" ADD CONSTRAINT "lands_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agriculture_lands" ADD CONSTRAINT "agriculture_lands_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."building_units" ADD CONSTRAINT "building_units_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."building" ADD CONSTRAINT "building_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."building" ADD CONSTRAINT "building_building_subtype_id_fkey" FOREIGN KEY ("building_subtype_id") REFERENCES "public"."building_subtypes"("building_subtype_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_address" ADD CONSTRAINT "property_address_province_id_fkey" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("province_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_address" ADD CONSTRAINT "property_address_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("district_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_address" ADD CONSTRAINT "property_address_commune_id_fkey" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("commune_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_address" ADD CONSTRAINT "property_address_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_locations" ADD CONSTRAINT "property_locations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE CASCADE ON UPDATE CASCADE;
