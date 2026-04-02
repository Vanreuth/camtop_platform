/*
  Warnings:

  - The values [Rectangle,Square,Triangle,Irregular] on the enum `LandShapeEnum` will be removed. If these variants are still used in the database, this will fail.
  - The values [Intermediate,Corner,End] on the enum `SitePositionEnum` will be removed. If these variants are still used in the database, this will fail.
  - The values [Level,Unlevel,Unfilled] on the enum `TopographyEnum` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."LandShapeEnum_new" AS ENUM ('RECTANGLE', 'SQUARE', 'TRIANGLE', 'IRREGULAR', 'SHAPE');
ALTER TABLE "public"."lands" ALTER COLUMN "landShape" TYPE "public"."LandShapeEnum_new" USING ("landShape"::text::"public"."LandShapeEnum_new");
ALTER TYPE "public"."LandShapeEnum" RENAME TO "LandShapeEnum_old";
ALTER TYPE "public"."LandShapeEnum_new" RENAME TO "LandShapeEnum";
DROP TYPE "public"."LandShapeEnum_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."SitePositionEnum_new" AS ENUM ('INTERMEDIATE', 'CORNER', 'END', 'MAIN_ROAD', 'SUB_ROAD');
ALTER TABLE "public"."lands" ALTER COLUMN "sitePosition" TYPE "public"."SitePositionEnum_new" USING ("sitePosition"::text::"public"."SitePositionEnum_new");
ALTER TYPE "public"."SitePositionEnum" RENAME TO "SitePositionEnum_old";
ALTER TYPE "public"."SitePositionEnum_new" RENAME TO "SitePositionEnum";
DROP TYPE "public"."SitePositionEnum_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."TopographyEnum_new" AS ENUM ('LEVEL', 'SLOPED', 'FILLED', 'UNLEVEL', 'UNFILLED');
ALTER TABLE "public"."lands" ALTER COLUMN "topography" TYPE "public"."TopographyEnum_new" USING ("topography"::text::"public"."TopographyEnum_new");
ALTER TYPE "public"."TopographyEnum" RENAME TO "TopographyEnum_old";
ALTER TYPE "public"."TopographyEnum_new" RENAME TO "TopographyEnum";
DROP TYPE "public"."TopographyEnum_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."agriculture_lands" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."building" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."building_photos" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."building_units" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."current_uses" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."lands" ALTER COLUMN "updated_at" DROP DEFAULT;
