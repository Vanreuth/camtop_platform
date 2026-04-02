-- DropForeignKey
ALTER TABLE "public"."property_address" DROP CONSTRAINT "property_address_village_id_fkey";

-- AlterTable
ALTER TABLE "public"."property_address" ALTER COLUMN "village_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."property_address" ADD CONSTRAINT "property_address_village_id_fkey" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("village_id") ON DELETE SET NULL ON UPDATE CASCADE;
