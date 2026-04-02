-- init-postgis.sql
-- This script automatically runs when the database container starts for the first time

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS installation
SELECT PostGIS_version();

-- Optional: Create spatial index function for better performance
CREATE OR REPLACE FUNCTION create_spatial_index(table_name text, column_name text)
RETURNS void AS $$
BEGIN
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_%I ON %I USING GIST (%I)', 
                   table_name, column_name, table_name, column_name);
END;
$$ LANGUAGE plpgsql;

-- Log success
DO $$
BEGIN
    RAISE NOTICE '✅ PostGIS extension enabled successfully!';
END $$;