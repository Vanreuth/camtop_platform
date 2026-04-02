-- AlterTable
ALTER TABLE "public"."properties" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by" INTEGER,
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejected_by" INTEGER,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "submitted_for_review_at" TIMESTAMP(3);
