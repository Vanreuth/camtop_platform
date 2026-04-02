ALTER TABLE "property_indicative_valuations"
ADD COLUMN IF NOT EXISTS "forced_sale_value" DECIMAL(18, 2);

UPDATE "property_indicative_valuations"
SET "forced_sale_value" = ROUND(COALESCE("max_value", 0) * 0.60, 2)
WHERE "forced_sale_value" IS NULL;
