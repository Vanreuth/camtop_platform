/*
  Warnings:

  - The values [ACTIVE,INACTIVE] on the enum `PropertyStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."PropertyStatus_new" AS ENUM ('DRAFT', 'SOLD', 'RENTED', 'RENTAL_SALE', 'PENDING_REVIEW', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');
ALTER TABLE "public"."properties" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."properties" ALTER COLUMN "status" TYPE "public"."PropertyStatus_new" USING ("status"::text::"public"."PropertyStatus_new");
ALTER TYPE "public"."PropertyStatus" RENAME TO "PropertyStatus_old";
ALTER TYPE "public"."PropertyStatus_new" RENAME TO "PropertyStatus";
DROP TYPE "public"."PropertyStatus_old";
ALTER TABLE "public"."properties" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "public"."properties" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
