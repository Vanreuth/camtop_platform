/*
  Warnings:

  - You are about to drop the column `use_id` on the `properties` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."properties" DROP CONSTRAINT "properties_use_id_fkey";

-- DropIndex
DROP INDEX "public"."properties_use_id_idx";

-- AlterTable
ALTER TABLE "public"."properties" DROP COLUMN "use_id";

-- AlterTable
ALTER TABLE "public"."property_locations" ADD COLUMN     "formatted_address" VARCHAR(255),
ADD COLUMN     "place_id" VARCHAR(100);

-- CreateIndex
CREATE INDEX "property_subtypes_property_type_id_idx" ON "public"."property_subtypes"("property_type_id");

-- CreateIndex
CREATE INDEX "property_types_record_type_id_idx" ON "public"."property_types"("record_type_id");
