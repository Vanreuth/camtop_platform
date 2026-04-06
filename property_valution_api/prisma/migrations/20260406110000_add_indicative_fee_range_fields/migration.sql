ALTER TABLE "property_indicative_valuations"
  ADD COLUMN IF NOT EXISTS "min_access_value" DECIMAL(18, 2),
  ADD COLUMN IF NOT EXISTS "max_access_value" DECIMAL(18, 2),
  ADD COLUMN IF NOT EXISTS "min_charge_fee" DECIMAL(18, 2),
  ADD COLUMN IF NOT EXISTS "max_charge_fee" DECIMAL(18, 2);

UPDATE "property_indicative_valuations"
SET
  "min_access_value" = CASE
    WHEN "access_value" IS NULL
      OR (
        "max_value" IS NOT NULL
        AND "min_value" IS NOT NULL
        AND "access_value" = "max_value"
        AND "min_value" <> "max_value"
      )
      THEN COALESCE("min_value", "access_value")
    ELSE "access_value"
  END,
  "max_access_value" = CASE
    WHEN "access_value" IS NULL
      OR (
        "max_value" IS NOT NULL
        AND "min_value" IS NOT NULL
        AND "access_value" = "max_value"
        AND "min_value" <> "max_value"
      )
      THEN COALESCE("max_value", "access_value")
    ELSE "access_value"
  END
WHERE "min_access_value" IS NULL
   OR "max_access_value" IS NULL;

UPDATE "property_indicative_valuations"
SET
  "min_charge_fee" = CASE
    WHEN "fee_rate" IS NOT NULL OR "discount" IS NOT NULL OR "access_value" IS NOT NULL
      THEN ROUND(
        COALESCE("min_access_value", 0)
        * (COALESCE("fee_rate", 0) / 100.0)
        * (1 - COALESCE("discount", 0) / 100.0),
        2
      )
    WHEN "charge_fee" IS NOT NULL THEN "charge_fee"
    ELSE NULL
  END,
  "max_charge_fee" = CASE
    WHEN "fee_rate" IS NOT NULL OR "discount" IS NOT NULL OR "access_value" IS NOT NULL
      THEN ROUND(
        COALESCE("max_access_value", 0)
        * (COALESCE("fee_rate", 0) / 100.0)
        * (1 - COALESCE("discount", 0) / 100.0),
        2
      )
    WHEN "charge_fee" IS NOT NULL THEN "charge_fee"
    ELSE NULL
  END
WHERE "min_charge_fee" IS NULL
   OR "max_charge_fee" IS NULL;
