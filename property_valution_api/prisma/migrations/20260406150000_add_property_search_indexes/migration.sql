-- Enable trigram search support for ILIKE/contains lookups.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Property list filters commonly combine workflow status with creator/type/status,
-- then sort or page by recent records.
CREATE INDEX IF NOT EXISTS "idx_properties_workflow_status"
  ON "properties" ("workflow_status");

CREATE INDEX IF NOT EXISTS "idx_properties_property_subtype_id"
  ON "properties" ("property_subtype_id");

CREATE INDEX IF NOT EXISTS "idx_properties_workflow_created_by_created_at"
  ON "properties" ("workflow_status", "created_by", "created_at");

CREATE INDEX IF NOT EXISTS "idx_properties_workflow_property_type_created_at"
  ON "properties" ("workflow_status", "property_type_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_properties_workflow_property_subtype_created_at"
  ON "properties" ("workflow_status", "property_subtype_id", "created_at");

CREATE INDEX IF NOT EXISTS "idx_properties_workflow_status_created_at"
  ON "properties" ("workflow_status", "status", "created_at");

-- Trigram indexes accelerate contains/ILIKE searches used by the property list.
CREATE INDEX IF NOT EXISTS "idx_properties_property_name_trgm"
  ON "properties" USING GIN ("property_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_properties_property_code_trgm"
  ON "properties" USING GIN ("property_code" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_data_sources_contact_name_trgm"
  ON "data_sources" USING GIN ("contact_name" gin_trgm_ops)
  WHERE "contact_name" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_data_sources_phone_number_trgm"
  ON "data_sources" USING GIN ("phone_number" gin_trgm_ops)
  WHERE "phone_number" IS NOT NULL;
