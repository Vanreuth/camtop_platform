/*
  Warnings:

  - The `polygon` column on the `property_locations` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."property_locations" ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7),
DROP COLUMN "polygon",
ADD COLUMN     "polygon" JSONB;
