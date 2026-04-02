ALTER TABLE "property_indicative_valuations"
  DROP COLUMN IF EXISTS "assumption",
  DROP COLUMN IF EXISTS "basis_of_value",
  DROP COLUMN IF EXISTS "valuation_method",
  DROP COLUMN IF EXISTS "authorized_by",
  ADD COLUMN "contact_name" VARCHAR(255),
  ADD COLUMN "contact_tel" VARCHAR(50);
