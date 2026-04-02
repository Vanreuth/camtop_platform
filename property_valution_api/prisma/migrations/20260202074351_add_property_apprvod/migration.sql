/*
  Warnings:

  - The values [PENDING_APPROVAL] on the enum `PropertyStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."NotificationType" ADD VALUE 'PROPERTY_SBMITTED';
ALTER TYPE "public"."NotificationType" ADD VALUE 'PROPERTY_APPROVED';
ALTER TYPE "public"."NotificationType" ADD VALUE 'PROPERTY_REJECTED';

-- AlterEnum
BEGIN;
CREATE TYPE "public"."PropertyStatus_new" AS ENUM ('ACTIVE', 'SOLD', 'RENTED', 'RENTAL_SALE', 'INACTIVE', 'PENDING_REVIEW', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');
ALTER TABLE "public"."properties" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."properties" ALTER COLUMN "status" TYPE "public"."PropertyStatus_new" USING ("status"::text::"public"."PropertyStatus_new");
ALTER TYPE "public"."PropertyStatus" RENAME TO "PropertyStatus_old";
ALTER TYPE "public"."PropertyStatus_new" RENAME TO "PropertyStatus";
DROP TYPE "public"."PropertyStatus_old";
ALTER TABLE "public"."properties" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterEnum
ALTER TYPE "public"."ValuationMethod" ADD VALUE 'SALES_AND_COST_APPROACH';
