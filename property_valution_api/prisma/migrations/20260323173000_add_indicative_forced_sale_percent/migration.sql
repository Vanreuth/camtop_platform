ALTER TABLE "property_indicative_valuations"
ADD COLUMN IF NOT EXISTS "forced_sale_percent" DECIMAL(5, 2);

UPDATE "property_indicative_valuations"
SET "forced_sale_percent" = 60.00
WHERE "forced_sale_percent" IS NULL;

UPDATE "property_indicative_valuations"
SET "forced_sale_value" = ROUND(COALESCE("max_value", 0) * (COALESCE("forced_sale_percent", 60.00) / 100.0), 2);
