-- DropForeignKey
ALTER TABLE "public"."comparables" DROP CONSTRAINT "comparables_property_subtype_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."comparables" DROP CONSTRAINT "comparables_property_type_id_fkey";

-- AlterTable
ALTER TABLE "public"."comparables" ADD COLUMN     "propertySubtypePropertySubtypeId" INTEGER,
ADD COLUMN     "propertyTypePropertyTypeId" INTEGER,
ALTER COLUMN "property_type_id" SET DATA TYPE TEXT,
ALTER COLUMN "property_subtype_id" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "public"."comparables" ADD CONSTRAINT "comparables_propertyTypePropertyTypeId_fkey" FOREIGN KEY ("propertyTypePropertyTypeId") REFERENCES "public"."property_types"("property_type_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comparables" ADD CONSTRAINT "comparables_propertySubtypePropertySubtypeId_fkey" FOREIGN KEY ("propertySubtypePropertySubtypeId") REFERENCES "public"."property_subtypes"("property_subtype_id") ON DELETE SET NULL ON UPDATE CASCADE;
