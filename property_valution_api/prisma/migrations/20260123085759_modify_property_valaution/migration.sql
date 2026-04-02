/*
  Warnings:

  - You are about to drop the column `valuer_license` on the `property_valuations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."property_valuations" DROP COLUMN "valuer_license",
ADD COLUMN     "inspector_name" VARCHAR(100),
ADD COLUMN     "prepared_for" VARCHAR(255),
ADD COLUMN     "price_per_sqm" DECIMAL(15,2);
