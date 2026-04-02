-- AlterTable
ALTER TABLE "public"."building" ADD COLUMN     "cost_estimation_per_sqm" DECIMAL(15,2),
ADD COLUMN     "effective_age" INTEGER,
ADD COLUMN     "total_cost_estimation" DECIMAL(15,2),
ADD COLUMN     "total_room" INTEGER,
ADD COLUMN     "useful_life" INTEGER;
