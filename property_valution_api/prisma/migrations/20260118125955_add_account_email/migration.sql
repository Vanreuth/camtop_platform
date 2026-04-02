/*
  Warnings:

  - The values [INACTIVE] on the enum `AccountStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `replacedBy` on the `refresh_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `dashboardLayout` on the `user_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `notifications` on the `user_preferences` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."AccountStatus_new" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED');
ALTER TABLE "public"."users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."users" ALTER COLUMN "status" TYPE "public"."AccountStatus_new" USING ("status"::text::"public"."AccountStatus_new");
ALTER TYPE "public"."AccountStatus" RENAME TO "AccountStatus_old";
ALTER TYPE "public"."AccountStatus_new" RENAME TO "AccountStatus";
DROP TYPE "public"."AccountStatus_old";
ALTER TABLE "public"."users" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "public"."refresh_tokens" DROP COLUMN "replacedBy",
ADD COLUMN     "replacedByToken" TEXT;

-- AlterTable
ALTER TABLE "public"."user_preferences" DROP COLUMN "dashboardLayout",
DROP COLUMN "notifications";

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "emailVerifyExpiresAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifyTokenHash" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "public"."refresh_tokens"("expiresAt");
