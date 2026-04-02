/*
  Warnings:

  - You are about to drop the column `newValues` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `oldValues` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `resource` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `resourceId` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the `user_sessions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."user_sessions" DROP CONSTRAINT "user_sessions_userId_fkey";

-- AlterTable
ALTER TABLE "public"."audit_logs" DROP COLUMN "newValues",
DROP COLUMN "oldValues",
DROP COLUMN "resource",
DROP COLUMN "resourceId",
ADD COLUMN     "entity" TEXT,
ADD COLUMN     "entityId" INTEGER,
ALTER COLUMN "action" SET DATA TYPE TEXT,
ALTER COLUMN "ipAddress" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "public"."user_sessions";

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "replacedBy" VARCHAR(255),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "public"."refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "public"."refresh_tokens"("userId");

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
