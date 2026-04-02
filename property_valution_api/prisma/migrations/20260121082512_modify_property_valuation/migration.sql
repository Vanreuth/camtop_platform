/*
  Warnings:

  - You are about to drop the column `latest_document_id` on the `property_valuations` table. All the data in the column will be lost.
  - You are about to drop the column `is_latest` on the `valuation_documents` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[valuation_id,latest_version]` on the table `property_valuations` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."property_valuations" DROP CONSTRAINT "property_valuations_latest_document_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."property_valuations" DROP CONSTRAINT "property_valuations_property_id_fkey";

-- DropIndex
DROP INDEX "public"."property_valuations_latest_document_id_key";

-- DropIndex
DROP INDEX "public"."valuation_documents_is_latest_idx";

-- AlterTable
ALTER TABLE "public"."property_valuations" DROP COLUMN "latest_document_id",
ADD COLUMN     "latest_version" INTEGER,
ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejected_by" INTEGER,
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ADD COLUMN     "submitted_by" INTEGER;

-- AlterTable
ALTER TABLE "public"."valuation_documents" DROP COLUMN "is_latest",
ALTER COLUMN "version" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "property_valuations_submitted_at_idx" ON "public"."property_valuations"("submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "property_valuations_valuation_id_latest_version_key" ON "public"."property_valuations"("valuation_id", "latest_version");

-- CreateIndex
CREATE INDEX "valuation_documents_valuation_id_uploaded_at_idx" ON "public"."valuation_documents"("valuation_id", "uploaded_at");

-- AddForeignKey
ALTER TABLE "public"."property_valuations" ADD CONSTRAINT "property_valuations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("property_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_valuations" ADD CONSTRAINT "property_valuations_valuation_id_latest_version_fkey" FOREIGN KEY ("valuation_id", "latest_version") REFERENCES "public"."valuation_documents"("valuation_id", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_valuations" ADD CONSTRAINT "property_valuations_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."property_valuations" ADD CONSTRAINT "property_valuations_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
