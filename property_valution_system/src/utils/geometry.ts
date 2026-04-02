export const GeometryUtils = {
  // Compute Area (m²)
  computeArea: (path: { lat: number; lng: number }[]) => {
    if (typeof google !== "undefined" && google.maps.geometry) {
      return google.maps.geometry.spherical.computeArea(path);
    }
    // Simple fallback if geometry lib is missing (not accurate for large areas)
    return 0;
  },

  // Compute Distance (meters)
  computeDistance: (
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ) => {
    if (typeof google !== "undefined" && google.maps.geometry) {
      return google.maps.geometry.spherical.computeDistanceBetween(from, to);
    }
    return 0;
  },

  // Compute Heading (degrees)
  computeHeading: (
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ) => {
    if (typeof google !== "undefined" && google.maps.geometry) {
      return google.maps.geometry.spherical.computeHeading(from, to);
    }
    return 0;
  },

  // Convert 0-360 bearing to cardinal direction
  getCardinalDirection: (angle: number) => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index =
      Math.round(((angle %= 360) < 0 ? angle + 360 : angle) / 45) % 8;
    return directions[index];
  },

  // Check if a polygon path is closed
  isClosed: (path: { lat: number; lng: number }[]) => {
    if (path.length < 3) return false;
    const first = path[0];
    const last = path[path.length - 1];
    return first.lat === last.lat && first.lng === last.lng;
  },
};