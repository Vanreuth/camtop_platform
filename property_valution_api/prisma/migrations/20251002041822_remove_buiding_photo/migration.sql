/*
  Warnings:

  - You are about to drop the `building_photos` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."building_photos" DROP CONSTRAINT "building_photos_building_id_fkey";

-- AlterTable
ALTER TABLE "public"."building" ADD COLUMN     "image_url" VARCHAR(500),
ADD COLUMN     "viewType" "public"."ViewType";

-- DropTable
DROP TABLE "public"."building_photos";
