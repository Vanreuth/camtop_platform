/*
  Warnings:

  - The values [PROPERTY_SBMITTED] on the enum `NotificationType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."NotificationType_new" AS ENUM ('PROPERTY_SUBMITTED', 'PROPERTY_APPROVED', 'PROPERTY_REJECTED', 'VALUATION_SUBMITTED', 'VALUATION_APPROVED', 'VALUATION_REJECTED', 'SYSTEM_ANNOUNCEMENT');
ALTER TABLE "public"."notifications" ALTER COLUMN "type" TYPE "public"."NotificationType_new" USING ("type"::text::"public"."NotificationType_new");
ALTER TYPE "public"."NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "public"."NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;
