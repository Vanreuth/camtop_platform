
import { DrawnShape } from "@/types/googleMap.types";
import { GeoJsonPolygon } from "@/hooks/propertyValuation/propertyValuation.types";

const isPolygonDebugEnabled =
  process.env.NEXT_PUBLIC_DEBUG_POLYGON === "true";

const debugPolygonLog = (...args: unknown[]) => {
  if (isPolygonDebugEnabled) {
    console.log(...args);
  }
};

/**
 * Convert a Google Maps Polygon path to GeoJSON coordinates
 */
const polygonToGeoJson = (polygon: google.maps.Polygon): [number, number][] => {
  const path = polygon.getPath();
  const coordinates: [number, number][] = [];
  
  for (let i = 0; i < path.getLength(); i++) {
    const point = path.getAt(i);
    // GeoJSON uses [longitude, latitude] order
    const coord: [number, number] = [point.lng(), point.lat()];
    coordinates.push(coord);
  }
  
  // Ensure the ring is closed (first point === last point)
  if (coordinates.length > 0) {
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      const closingPoint: [number, number] = [first[0], first[1]];
      coordinates.push(closingPoint);
    }
  }
  
  return coordinates;
};

/**
 * Convert a Google Maps Rectangle to GeoJSON coordinates
 */
const rectangleToGeoJson = (rectangle: google.maps.Rectangle): [number, number][] => {
  const bounds = rectangle.getBounds();
  if (!bounds) return [];
  
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  
  // Create polygon from rectangle bounds
  const bottomLeft: [number, number] = [sw.lng(), sw.lat()];
  const bottomRight: [number, number] = [ne.lng(), sw.lat()];
  const topRight: [number, number] = [ne.lng(), ne.lat()];
  const topLeft: [number, number] = [sw.lng(), ne.lat()];
  const close: [number, number] = [sw.lng(), sw.lat()];
  
  return [bottomLeft, bottomRight, topRight, topLeft, close];
};

/**
 * Convert a Google Maps Circle to GeoJSON coordinates
 * Approximates circle with 64 points
 */
const circleToGeoJson = (circle: google.maps.Circle, points: number = 64): [number, number][] => {
  const center = circle.getCenter();
  const radius = circle.getRadius();
  
  if (!center || !window.google?.maps?.geometry?.spherical) {
    console.error("Google Maps geometry library not loaded");
    return [];
  }
  
  const coordinates: [number, number][] = [];
  
  for (let i = 0; i < points; i++) {
    const heading = (i * 360) / points;
    const point = google.maps.geometry.spherical.computeOffset(center, radius, heading);
    const coord: [number, number] = [point.lng(), point.lat()];
    coordinates.push(coord);
  }
  
  // Close the ring
  if (coordinates.length > 0) {
    const first = coordinates[0];
    const closingPoint: [number, number] = [first[0], first[1]];
    coordinates.push(closingPoint);
  }
  
  return coordinates;
};

/**
 * Convert drawn shapes to a single GeoJSON Polygon
 * Priority order: polygon > rectangle > circle
 * Returns the first valid shape found
 */
export const convertShapesToGeoJson = (
  shapes: DrawnShape[]
): GeoJsonPolygon | null => {
  if (!shapes || shapes.length === 0) {
    return null;
  }

  // Priority: Use polygon first, then rectangle, then circle
  const polygonShape = shapes.find((s) => s.type === "polygon");
  const rectangleShape = shapes.find((s) => s.type === "rectangle");
  const circleShape = shapes.find((s) => s.type === "circle");
  
  let coordinates: [number, number][] = [];
  
  try {
    if (polygonShape?.shape) {
      // Verify the shape has the required method
      if (typeof (polygonShape.shape as any).getPath !== 'function') {
        console.error("❌ Polygon shape doesn't have getPath method:", polygonShape.shape);
        return null;
      }
      coordinates = polygonToGeoJson(polygonShape.shape as google.maps.Polygon);
    } else if (rectangleShape?.shape) {
      // Verify the shape has the required method
      if (typeof (rectangleShape.shape as any).getBounds !== 'function') {
        console.error("❌ Rectangle shape doesn't have getBounds method:", rectangleShape.shape);
        return null;
      }
      coordinates = rectangleToGeoJson(rectangleShape.shape as google.maps.Rectangle);
    } else if (circleShape?.shape) {
      // Verify the shape has the required methods
      if (typeof (circleShape.shape as any).getCenter !== 'function' || 
          typeof (circleShape.shape as any).getRadius !== 'function') {
        console.error("❌ Circle shape doesn't have required methods:", circleShape.shape);
        return null;
      }
      coordinates = circleToGeoJson(circleShape.shape as google.maps.Circle);
    } else {
      debugPolygonLog("No valid shape found in shapes array");
    }
  } catch (error) {
    console.error("❌ Error converting shape to GeoJSON:", error);
    return null;
  }

  if (coordinates.length === 0) {
    debugPolygonLog("Empty coordinates after conversion");
    return null;
  }
  
  // Validate coordinates
  const isValid = coordinates.every(
    (coord) =>
      Array.isArray(coord) &&
      coord.length === 2 &&
      typeof coord[0] === "number" &&
      typeof coord[1] === "number" &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1])
  );
  
  if (!isValid) {
    console.error("Invalid coordinates generated");
    return null;
  }
  
  // Return with exact type matching backend
  const geoJsonPolygon: GeoJsonPolygon = {
    type: "Polygon",
    coordinates: [coordinates] as [number, number][][],
  };
  
  return geoJsonPolygon;
};

/**
 * Log polygon info for debugging
 */
export const logPolygonInfo = (polygon: GeoJsonPolygon | null, label: string = "Polygon") => {
  if (!isPolygonDebugEnabled) return;

  if (!polygon) {
    debugPolygonLog(`❌ ${label}: No polygon data`);
    return;
  }
  
  const ring = polygon.coordinates[0];
  const isClosed = ring.length > 0 && 
    ring[0][0] === ring[ring.length - 1][0] && 
    ring[0][1] === ring[ring.length - 1][1];
  
  debugPolygonLog(`✅ ${label}:`, {
    type: polygon.type,
    totalRings: polygon.coordinates.length,
    pointsInRing: ring.length,
    isClosed,
    firstPoint: ring[0],
    lastPoint: ring[ring.length - 1],
    samplePoints: ring.slice(0, 3),
  });
};
