-- DropForeignKey
ALTER TABLE "public"."property_types" DROP CONSTRAINT "property_types_record_type_id_fkey";

-- AlterTable
ALTER TABLE "public"."property_types" ALTER COLUMN "record_type_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."property_subtypes" (
    "property_subtype_id" SERIAL NOT NULL,
    "property_type_id" INTEGER NOT NULL,
    "subtype_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_subtypes_pkey" PRIMARY KEY ("property_subtype_id")
);

-- AddForeignKey
ALTER TABLE "public"."property_types" ADD CONSTRAINT "property_types_record_type_id_fkey" FOREIGN KEY ("record_type_id") REFERENCES "public"."record_types"("record_type_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_subtypes" ADD CONSTRAINT "property_subtypes_property_type_id_fkey" FOREIGN KEY ("property_type_id") REFERENCES "public"."property_types"("property_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;
