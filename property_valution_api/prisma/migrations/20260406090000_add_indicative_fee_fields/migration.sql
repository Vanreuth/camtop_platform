ALTER TABLE "property_indicative_valuations"
  ADD COLUMN IF NOT EXISTS "access_value" DECIMAL(18, 2),
  ADD COLUMN IF NOT EXISTS "fee_rate" DECIMAL(7, 4),
  ADD COLUMN IF NOT EXISTS "discount" DECIMAL(7, 4);
