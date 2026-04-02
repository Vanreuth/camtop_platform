"use client";

import React, { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { GoogleMapGIS } from "@/components/googleMap/GoogleMapGIS";
import {
  Ruler,
  Square,
  TriangleAlert,
  MapPin,
  School,
  Building2,
  Utensils,
  Landmark,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Navigation,
  Eye,
  EyeOff,
  Pencil,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============ Type Definitions ============
type GeoJSONPolygon = {
  type: "Polygon";
  coordinates: number[][][]; // [ [ [lng,lat], ... ] ]
};

type LatLng = { lat: number; lng: number };
type PlaceType = "school" | "hospital" | "restaurant" | "bank" | "supermarket" | "other";
type CardinalDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

// ============ Constants ============
const EARTH_RADIUS_M = 6378137;
const MAX_NEARBY_PLACES = 5;
// zoom rules (valuation detail)
const MAP_ZOOM_PADDING = 70;
const MAP_MAX_ZOOM = 20;

// VIEW (detail page) — very zoom
const MAP_VIEW_ZOOM = 19;      // 👈 very zoom
const MAP_VIEW_MIN_ZOOM = 18;  // 👈 never zoom out below this

// EDIT/DRAW
const MAP_MIN_DRAW_ZOOM = 17;
const MAP_DRAW_ZOOM = 18;

// Marker-only fallback
const MAP_SINGLE_MARKER_ZOOM = 19; 
interface NearbyPlace {
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  distance: number;
  direction: CardinalDirection | "N/A";
  address?: string;
  rating?: number;
}

interface AmenityItem {
  name: string;
  distance?: number;
  rating?: number;
  address?: string;
  lat?: number;
  lng?: number;
}

interface NearbyAmenities {
  schools?: AmenityItem[];
  hospitals?: AmenityItem[];
  restaurants?: AmenityItem[];
  banks?: AmenityItem[];
  supermarkets?: AmenityItem[];
}

interface ValuationMapGISProps {
  valuation: any;
  nearbyAmenities?: NearbyAmenities;
}

// ============ Utility ============
const toRadians = (deg: number): number => (deg * Math.PI) / 180;
const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

const toLatLngs = (coords: number[][] | undefined): LatLng[] => {
  if (!coords?.length) return [];
  return coords
    .map((pair) => ({ lng: pair?.[0], lat: pair?.[1] }))
    .filter((p) => isFiniteNumber(p.lat) && isFiniteNumber(p.lng));
};

const computeAreaSqMeters = (points: LatLng[]) => {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const lng1 = toRadians(p1.lng);
    const lng2 = toRadians(p2.lng);
    const lat1 = toRadians(p1.lat);
    const lat2 = toRadians(p2.lat);
    sum += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
};

const computeCentroid = (points: LatLng[]) => {
  if (!points.length) return null;
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), {
    lat: 0,
    lng: 0,
  });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
};

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);

const parseNum = (v: string | number | null | undefined) => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const parsePolygon = (raw: unknown): GeoJSONPolygon | undefined => {
  if (!raw) return undefined;
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (
    typeof value === "object" &&
    value !== null &&
    (value as GeoJSONPolygon).type === "Polygon" &&
    Array.isArray((value as GeoJSONPolygon).coordinates)
  ) {
    return value as GeoJSONPolygon;
  }
  return undefined;
};

const calculateDistanceMeters = (from: LatLng, to: LatLng): number => {
  if (
    !from ||
    !to ||
    !isFiniteNumber(from.lat) ||
    !isFiniteNumber(from.lng) ||
    !isFiniteNumber(to.lat) ||
    !isFiniteNumber(to.lng)
  ) {
    return 0;
  }

  const lat1Rad = toRadians(from.lat);
  const lat2Rad = toRadians(to.lat);
  const dLatRad = toRadians(to.lat - from.lat);
  const dLngRad = toRadians(to.lng - from.lng);

  const sinDLat = Math.sin(dLatRad / 2);
  const sinDLng = Math.sin(dLngRad / 2);

  const a =
    sinDLat * sinDLat +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_M * c);
};

const calculateBearing = (from: LatLng, to: LatLng): number => {
  if (
    !from ||
    !to ||
    !isFiniteNumber(from.lat) ||
    !isFiniteNumber(from.lng) ||
    !isFiniteNumber(to.lat) ||
    !isFiniteNumber(to.lng)
  ) {
    return 0;
  }

  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return ((Math.atan2(y, x) * (180 / Math.PI) + 360) % 360);
};

const bearingToDirection = (bearing: number): CardinalDirection => {
  const normalized = ((bearing % 360) + 360) % 360;
  const index = Math.round((normalized + 22.5) / 45) % 8;
  const directions: CardinalDirection[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[index];
};

const getDirectionLabel = (direction: string): string => {
  const labels: Record<string, string> = {
    N: "North",
    NE: "Northeast",
    E: "East",
    SE: "Southeast",
    S: "South",
    SW: "Southwest",
    W: "West",
    NW: "Northwest",
  };
  return labels[direction] || direction;
};

interface PlaceStyle {
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  markerColor: string;
  label: string;
}

const getPlaceTypeStyle = (type: PlaceType): PlaceStyle => {
  const styles: Record<PlaceType, PlaceStyle> = {
    school: { icon: School, color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200", markerColor: "#2563eb", label: "Schools" },
    hospital: { icon: Building2, color: "text-red-600", bgColor: "bg-red-50 border-red-200", markerColor: "#dc2626", label: "Healthcare" },
    restaurant: { icon: Utensils, color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200", markerColor: "#ea580c", label: "Restaurants" },
    bank: { icon: Landmark, color: "text-green-600", bgColor: "bg-green-50 border-green-200", markerColor: "#16a34a", label: "Banks" },
    supermarket: { icon: ShoppingCart, color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200", markerColor: "#9333ea", label: "Supermarkets" },
    other: { icon: MapPin, color: "text-gray-600", bgColor: "bg-gray-50 border-gray-200", markerColor: "#6b7280", label: "Other" },
  };
  return styles[type];
};

const formatDistance = (meters: number): string => {
  if (!isFiniteNumber(meters) || meters < 0) return "0m";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters)}m`;
};

// ✅ IMPORTANT: run AFTER fitBounds using a timeout (fitBounds updates zoom async)
const clampZoomAfterFit = (map: google.maps.Map, minZoom: number, maxZoom: number) => {
  window.setTimeout(() => {
    const z = map.getZoom();
    if (typeof z !== "number") return;
    if (z > maxZoom) map.setZoom(maxZoom);
    if (z < minZoom) map.setZoom(minZoom);
  }, 0);
};

const fitToGeometry = (
  map: google.maps.Map,
  opts: { marker?: LatLng | null; polygonPoints?: LatLng[]; mode?: "view" | "edit" }
) => {
  const bounds = new google.maps.LatLngBounds();
  const mode = opts.mode ?? "view";

  const validPoints = opts.polygonPoints?.filter((p) => isFiniteNumber(p.lat) && isFiniteNumber(p.lng));

  const minZoom = mode === "edit" ? MAP_MIN_DRAW_ZOOM : MAP_VIEW_MIN_ZOOM;

  // 1) polygon
  if (validPoints && validPoints.length >= 3) {
    validPoints.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, MAP_ZOOM_PADDING);
    clampZoomAfterFit(map, minZoom, MAP_MAX_ZOOM);
    return;
  }

  // 2) marker only
  if (opts.marker && isFiniteNumber(opts.marker.lat) && isFiniteNumber(opts.marker.lng)) {
    bounds.extend(opts.marker);
    map.fitBounds(bounds, MAP_ZOOM_PADDING * 2);
    window.setTimeout(() => {
      const z = map.getZoom();
      if (typeof z !== "number") return;
      if (z > MAP_SINGLE_MARKER_ZOOM) map.setZoom(MAP_SINGLE_MARKER_ZOOM);
      if (z < minZoom) map.setZoom(minZoom);
    }, 0);
  }
};

export function ValuationMapGIS({ valuation, nearbyAmenities }: ValuationMapGISProps) {
  const loc = valuation?.property?.propertyLocation;
  const addr = valuation?.property?.propertyAddress;

  const [showNearbyPlaces, setShowNearbyPlaces] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>("schools");

  // ✅ map instance from GoogleMapGIS
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  // ✅ draw/edit mode
  const [editBoundary, setEditBoundary] = useState(false);

  const nearbyMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const lat = parseNum(loc?.latitude);
  const lng = parseNum(loc?.longitude);

  const polygon = parsePolygon(loc?.polygon);
  const ring = polygon?.type === "Polygon" ? polygon.coordinates?.[0] : undefined;

  const points = useMemo(() => toLatLngs(ring), [ring]);
  const hasValidPolygon = points.length >= 3;

  const areaSqMeters = hasValidPolygon ? computeAreaSqMeters(points) : 0;
  const areaHectares = areaSqMeters / 10000;
  const centroid = hasValidPolygon ? computeCentroid(points) : null;

  const isValidCoords = lat !== null && lng !== null;
  const propertyLocation: LatLng | null = isValidCoords ? { lat: lat!, lng: lng! } : null;
  const mapAnchor: LatLng | null = propertyLocation ?? centroid ?? points[0] ?? null;
  const hasRenderableLocation = mapAnchor !== null;

  // Nearby places computed list
  const processedPlaces = useMemo(() => {
    if (!nearbyAmenities || !mapAnchor) return [];

    const allPlaces: NearbyPlace[] = [];
    const addPlaces = (items: any[] | undefined, type: NearbyPlace["type"]) => {
      items?.forEach((item) => {
        if (!item.lat || !item.lng || !isFiniteNumber(item.lat) || !isFiniteNumber(item.lng)) return;

        const placeCoords = { lat: item.lat, lng: item.lng };
        const distance =
          typeof item.distance === "number" && item.distance > 0
            ? item.distance
            : calculateDistanceMeters(mapAnchor, placeCoords);

        const bearing = calculateBearing(mapAnchor, placeCoords);
        const direction = bearingToDirection(bearing);

        allPlaces.push({
          name: item.name,
          type,
          lat: item.lat,
          lng: item.lng,
          distance,
          direction,
          address: item.address,
          rating: item.rating,
        });
      });
    };

    addPlaces(nearbyAmenities.schools, "school");
    addPlaces(nearbyAmenities.hospitals, "hospital");
    addPlaces(nearbyAmenities.restaurants, "restaurant");
    addPlaces(nearbyAmenities.banks, "bank");
    addPlaces(nearbyAmenities.supermarkets, "supermarket");

    return allPlaces.sort((a, b) => a.distance - b.distance).slice(0, MAX_NEARBY_PLACES);
  }, [mapAnchor, nearbyAmenities]);

  // ✅ IMPORTANT: zoom behavior should be independent of nearby places
  useEffect(() => {
    if (!mapInstance) return;

    fitToGeometry(mapInstance, {
      marker: mapAnchor,
      polygonPoints: hasValidPolygon ? points : [],
      mode: editBoundary ? "edit" : "view",
    });

    // if edit mode, make it comfortably close
    if (editBoundary) {
      const target = centroid ?? mapAnchor;
      if (target) mapInstance.panTo(target);

      window.setTimeout(() => {
        const z = mapInstance.getZoom() ?? 0;
        if (z < MAP_MIN_DRAW_ZOOM) mapInstance.setZoom(MAP_DRAW_ZOOM);
      }, 0);
    }
  }, [centroid, editBoundary, hasValidPolygon, mapAnchor, mapInstance, points]);

  // Nearby markers effect (ONLY markers)
  useEffect(() => {
    // clear existing markers
    nearbyMarkersRef.current.forEach((m) => {
      try { m.map = null; } catch {}
    });
    nearbyMarkersRef.current = [];

    if (!mapInstance || !showNearbyPlaces || processedPlaces.length === 0) return;

    const newMarkers: google.maps.marker.AdvancedMarkerElement[] = [];

    processedPlaces.forEach((place, index) => {
      const style = getPlaceTypeStyle(place.type);

      const markerElement = document.createElement("div");
      markerElement.style.cssText = "cursor:pointer; position:relative;";
      markerElement.innerHTML = `
        <div style="
          width:26px;height:26px;
          background:${style.markerColor};
          color:#fff;border-radius:999px;
          display:flex;align-items:center;justify-content:center;
          font-size:12px;font-weight:800;
          border:2px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,.3);
        ">${index + 1}</div>
      `;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapInstance,
        position: { lat: place.lat, lng: place.lng },
        content: markerElement,
        title: `${index + 1}: ${place.name} - ${formatDistance(place.distance)} ${getDirectionLabel(place.direction)}`,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding:12px;max-width:250px;font-family:system-ui,-apple-system,sans-serif;">
            <div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#111827;">
              ${index + 1}. ${place.name}
            </div>
            <div style="font-size:13px;color:#6b7280;line-height:1.5;">
              <div><b>${formatDistance(place.distance)}</b> to ${getDirectionLabel(place.direction)}</div>
              ${place.address ? `<div style="margin-top:6px;font-size:12px;color:#9ca3af;">${place.address}</div>` : ""}
              ${place.rating ? `<div style="margin-top:6px;font-weight:600;">⭐ ${place.rating.toFixed(1)}</div>` : ""}
            </div>
          </div>
        `,
      });

      markerElement.addEventListener("click", () => infoWindow.open(mapInstance, marker));
      newMarkers.push(marker);
    });

    nearbyMarkersRef.current = newMarkers;

    return () => {
      newMarkers.forEach((m) => {
        try { m.map = null; } catch {}
      });
    };
  }, [mapInstance, showNearbyPlaces, processedPlaces]);

  const handleMapLoad = useCallback(
    (map: google.maps.Map) => {
      setMapInstance(map);
      fitToGeometry(map, {
        marker: mapAnchor,
        polygonPoints: hasValidPolygon ? points : [],
        mode: "view",
      });
    },
    [hasValidPolygon, mapAnchor, points]
  );

  // Grouping for legend
  const groupedPlaces = useMemo(() => {
    const groups: Record<string, NearbyPlace[]> = {
      schools: [],
      hospitals: [],
      restaurants: [],
      banks: [],
      supermarkets: [],
    };

    processedPlaces.forEach((p) => {
      const key = `${p.type}s`;
      if (groups[key]) groups[key].push(p);
    });

    return groups;
  }, [processedPlaces]);

  const getGlobalIndex = (type: string, localIndex: number): number => {
    let count = 0;
    const order = ["schools", "hospitals", "restaurants", "banks", "supermarkets"];
    for (const key of order) {
      if (key === type) return count + localIndex + 1;
      count += groupedPlaces[key]?.length || 0;
    }
    return localIndex + 1;
  };

  const renderPlaceSection = (
    type: string,
    label: string,
    IconComponent: React.ComponentType<any>,
    colorClass: string,
    bgClass: string
  ) => {
    const places = groupedPlaces[type];
    if (!places || places.length === 0) return null;

    const isExpanded = expandedSection === type;

    return (
      <div className={cn("rounded-lg border", bgClass)}>
        <button
          onClick={() => setExpandedSection(isExpanded ? null : type)}
          className="w-full p-3 flex items-center justify-between hover:bg-black/5 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <IconComponent className={cn("h-4 w-4", colorClass)} />
            <span className="text-sm font-medium">{label}</span>
            <Badge variant="secondary" className="text-xs">
              {places.length}
            </Badge>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 space-y-2">
            {places.map((place, idx) => {
              const globalIdx = getGlobalIndex(type, idx);
              const style = getPlaceTypeStyle(place.type);

              return (
                <div key={idx} className="flex items-start gap-3 p-2 bg-white/50 rounded-lg text-sm">
                  <div
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: style.markerColor }}
                  >
                    {globalIdx}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{place.name}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Navigation className="h-3 w-3" />
                        {formatDistance(place.distance)} to {getDirectionLabel(place.direction)}
                      </span>
                      {place.rating && <span className="flex items-center gap-0.5">⭐ {place.rating}</span>}
                    </div>
                    {place.address && <div className="text-xs text-gray-500 mt-0.5 truncate">{place.address}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {hasRenderableLocation ? (
        <div className="relative">
          <GoogleMapGIS
            coordinates={{ latitude: mapAnchor!.lat, longitude: mapAnchor!.lng }}
            addressCodes={{
              provinceId: addr?.province?.code || addr?.provinceId || null,
              districtId: addr?.district?.code || addr?.districtId || null,
              communeId: addr?.commune?.code || addr?.communeId || null,
              villageId: addr?.village?.code || addr?.villageId || null,
            }}
            // ✅ now can draw/edit boundary in valuation detail
            enableShapeDrawing={editBoundary}
            existingPolygon={polygon}
            disableBoundaryPinUpdate={true}
            height="500px"
            onMapLoad={handleMapLoad}
          />

          {/* Draw/Edit Boundary */}
          <div className="absolute top-3 left-3 z-10">
            <Button
              size="sm"
              variant={editBoundary ? "default" : "outline"}
              onClick={() => setEditBoundary((v) => !v)}
              className="shadow-lg"
            >
              {editBoundary ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Finish Drawing
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4 mr-1" />
                  Draw / Edit
                </>
              )}
            </Button>
          </div>

          {/* Nearby places toggle */}
          {processedPlaces.length > 0 && (
            <div className="absolute top-3 right-3 z-10">
              <Button
                size="sm"
                variant={showNearbyPlaces ? "default" : "outline"}
                onClick={() => setShowNearbyPlaces(!showNearbyPlaces)}
                className="shadow-lg"
              >
                {showNearbyPlaces ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-1" />
                    Hide Places
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    Show Places
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          Location is missing. Please verify property coordinates or polygon.
        </div>
      )}

      {/* Nearby Places Legend */}
      {processedPlaces.length > 0 && showNearbyPlaces && (
        <div className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-semibold text-gray-900">
              Nearby Locations ({processedPlaces.length})
            </span>
          </div>

          <div className="space-y-2">
            {renderPlaceSection("schools", "Schools", School, "text-blue-600", "bg-blue-50/50 border-blue-200")}
            {renderPlaceSection("hospitals", "Healthcare", Building2, "text-red-600", "bg-red-50/50 border-red-200")}
            {renderPlaceSection("restaurants", "Restaurants", Utensils, "text-orange-600", "bg-orange-50/50 border-orange-200")}
            {renderPlaceSection("banks", "Banks", Landmark, "text-green-600", "bg-green-50/50 border-green-200")}
            {renderPlaceSection("supermarkets", "Supermarkets", ShoppingCart, "text-purple-600", "bg-purple-50/50 border-purple-200")}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <div className="flex items-center gap-2 mb-2">
            <Square className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900">Boundary Polygon</span>
          </div>

          {polygon ? (
            <div className="text-sm text-blue-900">
              {hasValidPolygon ? (
                <>
                  <div className="font-medium">Points: {formatNumber(points.length)}</div>
                  <div className="text-xs text-blue-700">GeoJSON Polygon detected</div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-amber-700">
                  <TriangleAlert className="h-4 w-4" />
                  <span>Polygon data is incomplete.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-blue-800">No polygon saved for this property.</div>
          )}
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-center gap-2 mb-2">
            <Ruler className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-900">Measurements</span>
          </div>

          {hasValidPolygon ? (
            <div className="text-sm text-emerald-900 space-y-1">
              <div className="font-medium">Area: {formatNumber(areaSqMeters)} m²</div>
              <div className="text-xs text-emerald-700">~ {formatNumber(areaHectares, 2)} ha</div>
              {centroid && (
                <div className="text-xs text-emerald-700">
                  Center: {centroid.lat.toFixed(6)}, {centroid.lng.toFixed(6)}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-emerald-800">No measurement available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
