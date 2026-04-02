-- Add PostGIS geometry columns to property_locations table
-- This migration adds proper GIS spatial data types for efficient geographic queries

-- Add geometry point column (replaces string googlePoint)
ALTER TABLE property_locations 
ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- Add geometry polygon column (replaces JSON polygon)
ALTER TABLE property_locations 
ADD COLUMN IF NOT EXISTS geom_polygon geometry(Polygon, 4326);

-- Create spatial indexes for efficient proximity searches
CREATE INDEX IF NOT EXISTS idx_property_location_geom 
ON property_locations USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_property_location_geom_polygon 
ON property_locations USING GIST (geom_polygon);

-- Migrate existing data: Convert latitude/longitude to PostGIS Point geometry
UPDATE property_locations
SET geom = ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND geom IS NULL;

-- Add comment documentation
COMMENT ON COLUMN property_locations.geom IS 'PostGIS Point geometry for property location (SRID 4326 - WGS84)';
COMMENT ON COLUMN property_locations.geom_polygon IS 'PostGIS Polygon geometry for property boundary (SRID 4326 - WGS84)';

-- Create function to automatically update geom when lat/lng changes
CREATE OR REPLACE FUNCTION update_property_location_geom()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude::float, NEW.latitude::float), 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update geometry on insert/update
DROP TRIGGER IF EXISTS trigger_update_property_location_geom ON property_locations;
CREATE TRIGGER trigger_update_property_location_geom
    BEFORE INSERT OR UPDATE OF latitude, longitude
    ON property_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_property_location_geom();
