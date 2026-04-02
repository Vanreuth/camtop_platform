-- AlterTable
ALTER TABLE "public"."properties" ADD COLUMN     "current_use_id" INTEGER,
ADD COLUMN     "property_subtype_id" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."properties" ADD CONSTRAINT "properties_current_use_id_fkey" FOREIGN KEY ("current_use_id") REFERENCES "public"."current_uses"("use_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."properties" ADD CONSTRAINT "properties_property_subtype_id_fkey" FOREIGN KEY ("property_subtype_id") REFERENCES "public"."property_subtypes"("property_subtype_id") ON DELETE SET NULL ON UPDATE CASCADE;
