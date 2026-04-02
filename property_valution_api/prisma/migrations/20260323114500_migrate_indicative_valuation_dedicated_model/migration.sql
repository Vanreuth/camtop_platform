-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "PropertyIndicativeValuationStatus" AS ENUM (
    'ACTIVE',
    'SUPERSEDED',
    'EXPIRED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "property_indicative_valuations" (
  "indication_id" SERIAL NOT NULL,
  "property_id" INTEGER NOT NULL,
  "indication_no" VARCHAR(50) NOT NULL,
  "instruction_date" TIMESTAMP(3),
  "indication_date" TIMESTAMP(3),
  "instructed_by" VARCHAR(255),
  "intended_use" VARCHAR(255),
  "min_value" DECIMAL(18, 2) NOT NULL,
  "max_value" DECIMAL(18, 2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "assumption" VARCHAR(255),
  "basis_of_value" VARCHAR(255),
  "valuation_method" "ValuationMethod" NOT NULL DEFAULT 'SALES_COMPARISON_APPROACH',
  "authorized_by" VARCHAR(255),
  "valuer_id" INTEGER,
  "inspector_name" VARCHAR(100),
  "status" "PropertyIndicativeValuationStatus" NOT NULL DEFAULT 'ACTIVE',
  "workflow_status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  "rejection_reason" TEXT,
  "note" TEXT,
  "internal_notes" TEXT,
  "approved_by" INTEGER,
  "rejected_by" INTEGER,
  "created_by" INTEGER,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "legacy_valuation_id" INTEGER,

  CONSTRAINT "property_indicative_valuations_pkey" PRIMARY KEY ("indication_id")
);

-- Copy indicative valuation records out of property_valuations before changing the component link.
INSERT INTO "property_indicative_valuations" (
  "property_id",
  "indication_no",
  "instruction_date",
  "indication_date",
  "instructed_by",
  "intended_use",
  "min_value",
  "max_value",
  "currency",
  "assumption",
  "basis_of_value",
  "valuation_method",
  "authorized_by",
  "valuer_id",
  "inspector_name",
  "status",
  "workflow_status",
  "rejection_reason",
  "note",
  "internal_notes",
  "approved_by",
  "rejected_by",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
  "legacy_valuation_id"
)
SELECT
  pv."property_id",
  COALESCE(NULLIF(BTRIM(pv."valuation_no"), ''), 'IND-' || pv."valuation_id"::text),
  pv."date_of_inspection",
  pv."valuation_date",
  pv."prepared_for",
  pv."purpose_of_valuation",
  COALESCE(SUM(ivc."min_value"), 0),
  COALESCE(SUM(ivc."max_value"), 0),
  COALESCE(NULLIF(BTRIM(pv."currency"), ''), 'USD'),
  'As Is Basis',
  'Market Value',
  pv."valuation_method",
  NULL,
  pv."valuer_id",
  pv."inspector_name",
  pv."status"::text::"PropertyIndicativeValuationStatus",
  pv."workflowStatus",
  pv."rejection_reason",
  pv."note",
  pv."internal_notes",
  pv."approved_by",
  pv."rejected_by",
  pv."created_by",
  pv."updated_by",
  pv."created_at",
  pv."updated_at",
  pv."valuation_id"
FROM "property_valuations" pv
INNER JOIN "indicative_valuation_components" ivc
  ON ivc."valuation_id" = pv."valuation_id"
GROUP BY
  pv."valuation_id",
  pv."property_id",
  pv."valuation_no",
  pv."date_of_inspection",
  pv."valuation_date",
  pv."prepared_for",
  pv."purpose_of_valuation",
  pv."currency",
  pv."valuation_method",
  pv."valuer_id",
  pv."inspector_name",
  pv."status",
  pv."workflowStatus",
  pv."rejection_reason",
  pv."note",
  pv."internal_notes",
  pv."approved_by",
  pv."rejected_by",
  pv."created_by",
  pv."updated_by",
  pv."created_at",
  pv."updated_at";

-- AlterTable
ALTER TABLE "indicative_valuation_components"
  ADD COLUMN "indication_id" INTEGER,
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "description" VARCHAR(255);

-- Backfill the new relation and component descriptions.
UPDATE "indicative_valuation_components" ivc
SET "indication_id" = piv."indication_id"
FROM "property_indicative_valuations" piv
WHERE piv."legacy_valuation_id" = ivc."valuation_id";

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "valuation_id"
      ORDER BY "id"
    ) - 1 AS rn
  FROM "indicative_valuation_components"
)
UPDATE "indicative_valuation_components" ivc
SET "sort_order" = ranked.rn
FROM ranked
WHERE ranked."id" = ivc."id";

UPDATE "indicative_valuation_components"
SET "description" = CASE "component_type"
  WHEN 'LAND' THEN 'Land'
  WHEN 'BUILDING' THEN 'Building'
  ELSE 'Other'
END
WHERE "description" IS NULL;

ALTER TABLE "indicative_valuation_components"
  ALTER COLUMN "indication_id" SET NOT NULL;

-- Drop old link to property_valuations and keep the final schema shape.
ALTER TABLE "indicative_valuation_components"
  DROP CONSTRAINT IF EXISTS "indicative_valuation_components_valuation_id_fkey";

DROP INDEX IF EXISTS "indicative_valuation_components_valuation_id_idx";

ALTER TABLE "indicative_valuation_components"
  DROP COLUMN "valuation_id",
  DROP COLUMN "unit",
  DROP COLUMN "created_at",
  DROP COLUMN "updated_at";

ALTER TABLE "property_indicative_valuations"
  DROP COLUMN "legacy_valuation_id";

-- CreateIndex
CREATE UNIQUE INDEX "property_indicative_valuations_indication_no_key"
  ON "property_indicative_valuations"("indication_no");

CREATE INDEX "property_indicative_valuations_property_id_idx"
  ON "property_indicative_valuations"("property_id");

CREATE INDEX "property_indicative_valuations_indication_date_idx"
  ON "property_indicative_valuations"("indication_date");

CREATE INDEX "property_indicative_valuations_status_idx"
  ON "property_indicative_valuations"("status");

CREATE INDEX "property_indicative_valuations_workflow_status_idx"
  ON "property_indicative_valuations"("workflow_status");

CREATE INDEX "indicative_valuation_components_indication_id_idx"
  ON "indicative_valuation_components"("indication_id");

CREATE INDEX "indicative_valuation_components_component_type_idx"
  ON "indicative_valuation_components"("component_type");

-- AddForeignKey
ALTER TABLE "property_indicative_valuations"
  ADD CONSTRAINT "property_indicative_valuations_property_id_fkey"
  FOREIGN KEY ("property_id")
  REFERENCES "properties"("property_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "property_indicative_valuations"
  ADD CONSTRAINT "property_indicative_valuations_valuer_id_fkey"
  FOREIGN KEY ("valuer_id")
  REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "property_indicative_valuations"
  ADD CONSTRAINT "property_indicative_valuations_approved_by_fkey"
  FOREIGN KEY ("approved_by")
  REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "property_indicative_valuations"
  ADD CONSTRAINT "property_indicative_valuations_rejected_by_fkey"
  FOREIGN KEY ("rejected_by")
  REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "property_indicative_valuations"
  ADD CONSTRAINT "property_indicative_valuations_created_by_fkey"
  FOREIGN KEY ("created_by")
  REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "property_indicative_valuations"
  ADD CONSTRAINT "property_indicative_valuations_updated_by_fkey"
  FOREIGN KEY ("updated_by")
  REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "indicative_valuation_components"
  ADD CONSTRAINT "indicative_valuation_components_indication_id_fkey"
  FOREIGN KEY ("indication_id")
  REFERENCES "property_indicative_valuations"("indication_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
