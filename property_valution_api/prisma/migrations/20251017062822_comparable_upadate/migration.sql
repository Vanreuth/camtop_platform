/*
  Warnings:

  - You are about to drop the column `village_id` on the `comparables` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."comparables" DROP COLUMN "village_id",
ADD COLUMN     "village_name" VARCHAR(100);
