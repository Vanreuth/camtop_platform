import { DrawnShape } from "@/types/googleMap.types";

type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

/**
 * Convert a Google Maps Polygon path to GeoJSON coordinates
 * GeoJSON format: [[[lng, lat], [lng, lat], ...]]
 */
const polygonToGeoJson = (polygon: google.maps.Polygon): number[][] => {
  const path = polygon.getPath();
  const coordinates: number[][] = [];
  
  for (let i = 0; i < path.getLength(); i++) {
    const point = path.getAt(i);
    // GeoJSON uses [longitude, latitude] order (opposite of Google Maps)
    coordinates.push([point.lng(), point.lat()]);
  }
  
  // Ensure the ring is closed (first point === last point)
  if (coordinates.length > 0) {
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coordinates.push([first[0], first[1]]);
    }
  }
  
  return coordinates;
};

/**
 * Convert a Google Maps Rectangle to GeoJSON polygon coordinates
 */
const rectangleToGeoJson = (rectangle: google.maps.Rectangle): number[][] => {
  const bounds = rectangle.getBounds();
  if (!bounds) return [];
  
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  
  // Create polygon from rectangle bounds (counterclockwise)
  return [
    [sw.lng(), sw.lat()], // Bottom-left
    [ne.lng(), sw.lat()], // Bottom-right
    [ne.lng(), ne.lat()], // Top-right
    [sw.lng(), ne.lat()], // Top-left
    [sw.lng(), sw.lat()], // Close the ring
  ];
};

/**
 * Convert a Google Maps Circle to GeoJSON polygon coordinates
 * Approximates circle with specified number of points (default 64)
 */
const circleToGeoJson = (circle: google.maps.Circle, points: number = 64): number[][] => {
  const center = circle.getCenter();
  const radius = circle.getRadius();
  
  if (!center || !window.google?.maps?.geometry?.spherical) {
    console.error("Google Maps geometry library not loaded");
    return [];
  }
  
  const coordinates: number[][] = [];
  
  for (let i = 0; i < points; i++) {
    const heading = (i * 360) / points;
    const point = google.maps.geometry.spherical.computeOffset(
      center,
      radius,
      heading
    );
    coordinates.push([point.lng(), point.lat()]);
  }
  
  // Close the ring
  if (coordinates.length > 0) {
    coordinates.push([coordinates[0][0], coordinates[0][1]]);
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
  
  let coordinates: number[][] = [];
  
  try {
    if (polygonShape?.shape) {
      coordinates = polygonToGeoJson(polygonShape.shape as google.maps.Polygon);
    } else if (rectangleShape?.shape) {
      coordinates = rectangleToGeoJson(rectangleShape.shape as google.maps.Rectangle);
    } else if (circleShape?.shape) {
      coordinates = circleToGeoJson(circleShape.shape as google.maps.Circle);
    }
  } catch (error) {
    console.error("Error converting shape to GeoJSON:", error);
    return null;
  }
  
  if (coordinates.length === 0) {
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
  
  return {
    type: "Polygon",
    coordinates: [coordinates], // GeoJSON Polygon requires array of rings
  };
};

/**
 * Convert shapes to JSON string for API submission
 * Returns null if no valid shapes
 */
export const shapesToPolygonString = (shapes: DrawnShape[]): string | null => {
  const geoJson = convertShapesToGeoJson(shapes);
  return geoJson ? JSON.stringify(geoJson) : null;
};

/**
 * Calculate area of a GeoJSON polygon in square meters
 * Uses spherical geometry for accuracy
 */
export const calculatePolygonArea = (polygon: GeoJsonPolygon): number => {
  if (!polygon?.coordinates?.[0] || !window.google?.maps?.geometry?.spherical) {
    return 0;
  }
  
  const ring = polygon.coordinates[0];
  const path = ring.map(
    (coord) => new google.maps.LatLng(coord[1], coord[0])
  );
  
  return google.maps.geometry.spherical.computeArea(path);
};

/**
 * Calculate perimeter of a GeoJSON polygon in meters
 */
export const calculatePolygonPerimeter = (polygon: GeoJsonPolygon): number => {
  if (!polygon?.coordinates?.[0] || !window.google?.maps?.geometry?.spherical) {
    return 0;
  }
  
  const ring = polygon.coordinates[0];
  let perimeter = 0;
  
  for (let i = 0; i < ring.length - 1; i++) {
    const from = new google.maps.LatLng(ring[i][1], ring[i][0]);
    const to = new google.maps.LatLng(ring[i + 1][1], ring[i + 1][0]);
    perimeter += google.maps.geometry.spherical.computeDistanceBetween(from, to);
  }
  
  return perimeter;
};

/**
 * Validate if a GeoJSON polygon is properly formatted
 */
export const isValidGeoJsonPolygon = (polygon: any): polygon is GeoJsonPolygon => {
  if (!polygon || typeof polygon !== "object") return false;
  if (polygon.type !== "Polygon") return false;
  if (!Array.isArray(polygon.coordinates)) return false;
  if (polygon.coordinates.length === 0) return false;
  
  const ring = polygon.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) return false;
  
  // Check all coordinates are valid [lng, lat] pairs
  return ring.every(
    (coord: any) =>
      Array.isArray(coord) &&
      coord.length === 2 &&
      typeof coord[0] === "number" &&
      typeof coord[1] === "number" &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1]) &&
      coord[0] >= -180 &&
      coord[0] <= 180 &&
      coord[1] >= -90 &&
      coord[1] <= 90
  );
};