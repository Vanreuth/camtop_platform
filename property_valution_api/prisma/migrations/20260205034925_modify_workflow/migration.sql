/*
  Warnings:

  - The values [DRAFT,PENDING_REVIEW,IN_REVIEW,APPROVED,REJECTED,ARCHIVED] on the enum `PropertyStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `entityId` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `ipAddress` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `approved_at` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `archived_at` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_at` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `deleted_by` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `rejected_at` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `submitted_for_review_at` on the `properties` table. All the data in the column will be lost.
  - You are about to drop the column `approved_at` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `rejected_at` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `submitted_at` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `submitted_by` on the `property_valuations` table. All the data in the column will be lost.
  - The `status` column on the `property_valuations` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."PropertyValuationStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."WorkflowStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."PropertyStatus_new" AS ENUM ('SOLD', 'RENTED', 'RENTAL_SALE', 'ACTIVE', 'INACTIVE');
ALTER TABLE "public"."properties" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."properties" ALTER COLUMN "status" TYPE "public"."PropertyStatus_new" USING ("status"::text::"public"."PropertyStatus_new");
ALTER TYPE "public"."PropertyStatus" RENAME TO "PropertyStatus_old";
ALTER TYPE "public"."PropertyStatus_new" RENAME TO "PropertyStatus";
DROP TYPE "public"."PropertyStatus_old";
ALTER TABLE "public"."properties" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."audit_logs" DROP CONSTRAINT "audit_logs_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."property_valuations" DROP CONSTRAINT "property_valuations_submitted_by_fkey";

-- DropIndex
DROP INDEX "public"."properties_deleted_at_idx";

-- DropIndex
DROP INDEX "public"."property_valuations_submitted_at_idx";

-- AlterTable
ALTER TABLE "public"."audit_logs" DROP COLUMN "entityId",
DROP COLUMN "ipAddress",
DROP COLUMN "userAgent",
DROP COLUMN "userId",
ADD COLUMN     "entity_id" INTEGER,
ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "user_agent" TEXT,
ADD COLUMN     "user_id" INTEGER;

-- AlterTable
ALTER TABLE "public"."properties" DROP COLUMN "approved_at",
DROP COLUMN "archived_at",
DROP COLUMN "deleted_at",
DROP COLUMN "deleted_by",
DROP COLUMN "rejected_at",
DROP COLUMN "submitted_for_review_at",
ADD COLUMN     "workflowStatus" "public"."WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "public"."property_valuations" DROP COLUMN "approved_at",
DROP COLUMN "rejected_at",
DROP COLUMN "submitted_at",
DROP COLUMN "submitted_by",
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "expiry_date" TIMESTAMP(3),
ADD COLUMN     "updated_by" INTEGER,
ADD COLUMN     "workflowStatus" "public"."WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
DROP COLUMN "status",
ADD COLUMN     "status" "public"."PropertyValuationStatus" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "building_value" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "forced_sale_value" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "land_value" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "market_value" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "price_per_sqm" SET DATA TYPE DECIMAL(18,2);

-- DropEnum
DROP TYPE "public"."ValuationStatus";

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "public"."audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "property_valuations_status_idx" ON "public"."property_valuations"("status");

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."properties" ADD CONSTRAINT "properties_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."properties" ADD CONSTRAINT "properties_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_valuations" ADD CONSTRAINT "property_valuations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_valuations" ADD CONSTRAINT "property_valuations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
