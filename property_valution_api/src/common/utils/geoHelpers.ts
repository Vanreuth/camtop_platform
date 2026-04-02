
/**
 * Convert GeoJSON Polygon to PostGIS WKT format
 * @param geoJson - GeoJSON Polygon object
 * @returns WKT string for PostGIS
 */
export const convertGeoJsonToWKT = (geoJson: any): string | null => {
  if (!geoJson || geoJson.type !== "Polygon" || !geoJson.coordinates) return null;
  try {
    const rings = geoJson.coordinates.map((ring: number[][]) => {
      const coords = ring.map((coord) => `${coord[0]} ${coord[1]}`).join(", ");
      return `(${coords})`;
    });
    return `POLYGON(${rings.join(", ")})`;
  } catch (error) {
    console.error("GeoJSON to WKT failed", error);
    return null;
  }
};

/**
 * Calculate centroid from GeoJSON polygon
 * @param geoJson - GeoJSON Polygon object
 * @returns {latitude, longitude} of centroid
 */
export const calculatePolygonCentroid = (geoJson: any): { latitude: number; longitude: number } | null => {
  if (!geoJson || geoJson.type !== "Polygon" || !geoJson.coordinates || !geoJson.coordinates[0]) {
    return null;
  }

  try {
    const ring = geoJson.coordinates[0]; // Outer ring
    let sumLat = 0;
    let sumLng = 0;
    let count = 0;

    // Skip the last point if it's a closing point (same as first)
    const points = ring.length > 0 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
        ? ring.slice(0, -1)
        : ring;

    for (const coord of points) {
      sumLng += coord[0]; // longitude
      sumLat += coord[1]; // latitude
      count++;
    }

    return {
      latitude: sumLat / count,
      longitude: sumLng / count,
    };
  } catch (error) {
    console.error("❌ Failed to calculate polygon centroid:", error);
    return null;
  }
};

/**
 * Normalize polygon data to GeoJSON format
 * Handles both string and object inputs
 */
export const normalizePolygonData = (polygon: any): any => {
  if (!polygon) return null;

  // If it's already an object with type "Polygon", return as-is
  if (typeof polygon === "object" && polygon.type === "Polygon") {
    return polygon;
  }

  // If it's a string, try to parse it as JSON
  if (typeof polygon === "string") {
    try {
      const parsed = JSON.parse(polygon);
      if (parsed.type === "Polygon") {
        return parsed;
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse polygon string as JSON, storing as-is");
    }
    // Return string as-is for backward compatibility
    return polygon;
  }

  return polygon;
};

