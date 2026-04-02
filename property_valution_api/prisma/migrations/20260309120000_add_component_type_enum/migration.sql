-- CreateEnum
CREATE TYPE "IndicativeComponentType" AS ENUM ('LAND', 'BUILDING', 'OTHER');

-- AlterTable: replace description column with component_type
ALTER TABLE "indicative_valuation_components"
  DROP COLUMN "description",
  ADD COLUMN "component_type" "IndicativeComponentType" NOT NULL DEFAULT 'LAND';
