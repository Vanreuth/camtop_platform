/*
  Warnings:

  - You are about to drop the column `comparableComparableId` on the `property_valuations` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."property_valuations" DROP CONSTRAINT "property_valuations_comparableComparableId_fkey";

-- AlterTable
ALTER TABLE "public"."property_valuations" DROP COLUMN "comparableComparableId";
