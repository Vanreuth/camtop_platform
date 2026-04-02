-- AlterTable
ALTER TABLE "public"."building_subtypes" ADD COLUMN     "property_type_id" INTEGER;

-- CreateIndex
CREATE INDEX "building_subtypes_property_type_id_idx" ON "public"."building_subtypes"("property_type_id");

-- AddForeignKey
ALTER TABLE "public"."building_subtypes" ADD CONSTRAINT "building_subtypes_property_type_id_fkey" FOREIGN KEY ("property_type_id") REFERENCES "public"."property_types"("property_type_id") ON DELETE SET NULL ON UPDATE CASCADE;
