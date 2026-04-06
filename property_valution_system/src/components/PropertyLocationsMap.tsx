import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { APIProvider, Map as GoogleMap, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import {
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Crosshair,
  Layers,
  Search,
  X,
  Info,
  MapPin,
  Map as MapIcon,
  Ruler,
  Trash2,
  Pentagon,
  Square,
  Circle as CircleIcon,
  Edit3,
} from "lucide-react";
import { MarkerClusterer, GridAlgorithm, type Cluster } from "@googlemaps/markerclusterer";
import {
  PropertyLocationMarker,
  getAdvancedMarkerPin,
  createInfoWindowContent,
  fitMapToBounds,
} from "@/lib/mapHelpers";
import { useLocale } from "next-intl";
import type {
  PropertySearchCircleParams,
  PropertySearchPolygonParams,
} from "@/types/property.types";
import {
  useProvinces,
  useDistrictsByProvinceCode,
  useCommunesByDistrictCode,
  useVillagesByCommuneCode,
} from "@/hooks/usePropertyAddress";

interface AddressFilter {
  provinceId: string | null;
  districtId: string | null;
  communeId: string | null;
  villageId: string | null;
}

type MapSearchMode = "none" | "circle" | "polygon" | "rectangle";
type DrawSearchShapeType = Exclude<MapSearchMode, "none">;
type CoverageFilter =
  | "all"
  | "property_only"
  | "property_valuation_only"
  | "indicative_valuation_only";

interface PropertyLocationsMapProps {
  properties: PropertyLocationMarker[];
  onPropertyClick?: (propertyId: number) => void;
  height?: string;
  enableClustering?: boolean;
  googleMapsApiKey?: string;
  googleMapsMapId?: string;
  addressFilter?: AddressFilter;
  onAddressFilterChange?: (filter: AddressFilter) => void;
  enableGISBoundaries?: boolean;
  coverageFilter?: CoverageFilter;
  searchMode?: MapSearchMode;
  onSearchModeChange?: (mode: MapSearchMode) => void;
  onSearchCircle?: (params: PropertySearchCircleParams) => void;
  onSearchPolygon?: (params: PropertySearchPolygonParams) => void;
  onSearchClear?: () => void;
  activeSearchPropertyIds?: number[] | null;
  onSearchResultChange?: (propertyIds: number[] | null) => void;
  searchResetToken?: number;
}

type MarkerLayer = "property" | "valuation" | "indicative";

type MarkerLayerEntry = {
  id: string;
  layer: MarkerLayer;
  property: PropertyLocationMarker;
  position: { lat: number; lng: number };
};

const MARKER_LAYER_PIXEL_OFFSETS: Record<MarkerLayer, { x: number; y: number }> = {
  property: { x: 0, y: 0 },
  valuation: { x: 18, y: -8 },
  indicative: { x: -18, y: -8 },
};

const MARKER_LAYER_Z_INDEX: Record<MarkerLayer, number> = {
  property: 1,
  valuation: 2,
  indicative: 3,
};

const MapBridge = ({
  onMapReady,
  onPlacesReady,
}: {
  onMapReady: (mapInstance: google.maps.Map) => void;
  onPlacesReady: () => void;
}) => {
  const map = useMap();
  const placesLibrary = useMapsLibrary("places");

  useEffect(() => {
    if (!map) return;
    onMapReady(map);
  }, [map, onMapReady]);

  useEffect(() => {
    if (!placesLibrary) return;
    onPlacesReady();
  }, [placesLibrary, onPlacesReady]);

  return null;
};

export default function PropertyLocationsMap({
  properties,
  onPropertyClick, 
  height = "calc(100vh - 80px)",
  enableClustering = true,
  googleMapsApiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "",
  googleMapsMapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "",
  addressFilter = { provinceId: null, districtId: null, communeId: null, villageId: null },
  onAddressFilterChange,
  enableGISBoundaries = true,
  coverageFilter = "all",
  searchMode = "none",
  onSearchModeChange,
  onSearchCircle,
  onSearchPolygon,
  onSearchClear,
  activeSearchPropertyIds = null,
  onSearchResultChange,
  searchResetToken = 0,
}: PropertyLocationsMapProps) {
  const MAX_AUTO_ZOOM = 16;
  const PLACE_FALLBACK_ZOOM = 15;
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [markerClusterer, setMarkerClusterer] = useState<MarkerClusterer | null>(null);
  const activeInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [placesReady, setPlacesReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid" | "terrain">("roadmap");
  const [showGISLayers, setShowGISLayers] = useState(enableGISBoundaries);
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showStreetViewLayer, setShowStreetViewLayer] = useState(false);
  const [isInStreetView, setIsInStreetView] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [hoveredProperty, setHoveredProperty] = useState<PropertyLocationMarker | null>(null);
  const [currentZoom, setCurrentZoom] = useState(7);
  const [propertyShapes, setPropertyShapes] = useState<Map<number, google.maps.Polygon>>(new Map());
  const [alwaysShowShapes, setAlwaysShowShapes] = useState(false);
  const [shapesVisible, setShapesVisible] = useState(false);

  // Measurement / Pin Mode State
  const [isPinMode, setIsPinMode] = useState(false);
  const [pinnedLocations, setPinnedLocations] = useState<Array<{lat: number, lng: number, label: string}>>([]);
  const [pinMarkers, setPinMarkers] = useState<google.maps.Marker[]>([]);
  const distanceLineRef = useRef<google.maps.Polyline | null>(null);
  const [totalDistance, setTotalDistance] = useState<number>(0);

  // Area Search State
  const searchShapeRef = useRef<
    google.maps.Polygon | google.maps.Rectangle | google.maps.Circle | null
  >(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const searchShapeListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const [drawnSearchShape, setDrawnSearchShape] = useState<{
    type: DrawSearchShapeType;
  } | null>(null);

  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const streetViewLayerRef = useRef<google.maps.StreetViewCoverageLayer | null>(null);
  const lastSearchResetTokenRef = useRef(searchResetToken);

  const normalizedSearchMode = searchMode ?? "none";
  const displayedProperties = useMemo(() => {
    if (activeSearchPropertyIds === null) return properties;
    const propertyIds = new Set(activeSearchPropertyIds);
    return properties.filter((property) => propertyIds.has(property.propertyId));
  }, [activeSearchPropertyIds, properties]);

  const markerEntries = useMemo<MarkerLayerEntry[]>(() => {
    const requestedLayers: MarkerLayer[] | null =
      coverageFilter === "property_only"
        ? ["property"]
        : coverageFilter === "property_valuation_only"
          ? ["valuation"]
          : coverageFilter === "indicative_valuation_only"
            ? ["indicative"]
            : null;

    return displayedProperties.flatMap((property) => {
      const baseLat = Number(property.latitude);
      const baseLng = Number(property.longitude);
      if (!Number.isFinite(baseLat) || !Number.isFinite(baseLng)) return [];

      const entries: MarkerLayerEntry[] = [];
      const propertyBase = {
        ...property,
        hasValuation: false,
        hasIndicativeValuation: false,
        valuation: [],
        indicativeValuation: [],
      };

      const visibleLayers =
        requestedLayers ??
        (() => {
          const layers: MarkerLayer[] = [];

          if (property.hasValuation) layers.push("valuation");
          if (property.hasIndicativeValuation) layers.push("indicative");
          if (!layers.length) layers.push("property");

          return layers;
        })();

      visibleLayers.forEach((layer) => {
        if (layer === "valuation" && !property.hasValuation) return;
        if (layer === "indicative" && !property.hasIndicativeValuation) return;

        const markerProperty =
          layer === "property"
            ? propertyBase
            : layer === "valuation"
              ? {
                  ...property,
                  hasValuation: true,
                  hasIndicativeValuation: false,
                  indicativeValuation: [],
                }
              : {
                  ...property,
                  hasValuation: false,
                  hasIndicativeValuation: true,
                  valuation: [],
                };

        entries.push({
          id: `${property.propertyId}-${layer}`,
          layer,
          property: markerProperty,
          position: {
            lat: baseLat,
            lng: baseLng,
          },
        });
      });

      return entries;
    });
  }, [coverageFilter, displayedProperties]);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Update distance line
  const updateDistanceLine = useCallback((locations: Array<{lat: number, lng: number, label: string}>, markers: google.maps.Marker[]) => {
  if (!map) return;

  const currentPositions = markers.map(marker => {
    const pos = marker.getPosition();
    return pos ? { lat: pos.lat(), lng: pos.lng() } : null;
  }).filter(Boolean) as Array<{lat: number, lng: number}>;

  // Clear existing line using REF
  if (distanceLineRef.current) {
    distanceLineRef.current.setMap(null);
    distanceLineRef.current = null;
  }

  if (currentPositions.length < 2) {
      setTotalDistance(0);
      return;
  }

  // Calculate total distance
  let total = 0;
  for (let i = 0; i < currentPositions.length - 1; i++) {
    total += calculateDistance(
      currentPositions[i].lat,
      currentPositions[i].lng,
      currentPositions[i + 1].lat,
      currentPositions[i + 1].lng
    );
  }
  
  // Only update state if the value is different (prevents loop on drag)
  setTotalDistance(prev => Math.abs(prev - total) > 0.001 ? total : prev);

  // Draw new line
  const line = new google.maps.Polyline({
    path: currentPositions,
    geodesic: true,
    strokeColor: '#EF4444',
    strokeOpacity: 1.0,
    strokeWeight: 3,
    map,
  });
  distanceLineRef.current = line;
}, [map]); 

  const clearSearchShapeListeners = useCallback(() => {
    searchShapeListenersRef.current.forEach((listener) =>
      google.maps.event.removeListener(listener),
    );
    searchShapeListenersRef.current = [];
  }, []);

  const getPolygonCoordinates = useCallback(
    (
      shape:
        | google.maps.Polygon
        | google.maps.Rectangle
        | google.maps.Circle
        | null,
      type: DrawSearchShapeType,
    ): Array<{ latitude: number; longitude: number }> => {
      if (!shape) return [];

      if (type === "polygon") {
        const path = (shape as google.maps.Polygon).getPath();
        const coordinates: Array<{ latitude: number; longitude: number }> = [];
        for (let index = 0; index < path.getLength(); index += 1) {
          const point = path.getAt(index);
          coordinates.push({
            latitude: point.lat(),
            longitude: point.lng(),
          });
        }
        return coordinates;
      }

      if (type === "rectangle") {
        const bounds = (shape as google.maps.Rectangle).getBounds();
        if (!bounds) return [];
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        return [
          { latitude: southWest.lat(), longitude: southWest.lng() },
          { latitude: southWest.lat(), longitude: northEast.lng() },
          { latitude: northEast.lat(), longitude: northEast.lng() },
          { latitude: northEast.lat(), longitude: southWest.lng() },
        ];
      }

      return [];
    },
    [],
  );

  const updateSearchResultFromShape = useCallback(
    (
      shape:
        | google.maps.Polygon
        | google.maps.Rectangle
        | google.maps.Circle
        | null,
      type: DrawSearchShapeType,
    ) => {
      if (!shape || !window.google?.maps?.geometry) {
        onSearchResultChange?.(null);
        return;
      }

      const propertyIds = properties
        .filter((property) => {
          const latitude = Number(property.latitude);
          const longitude = Number(property.longitude);

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return false;
          }

          const point = new google.maps.LatLng(latitude, longitude);

          if (type === "circle") {
            const circle = shape as google.maps.Circle;
            const center = circle.getCenter();
            if (!center) return false;
            return (
              google.maps.geometry.spherical.computeDistanceBetween(center, point) <=
              circle.getRadius()
            );
          }

          if (type === "rectangle") {
            const bounds = (shape as google.maps.Rectangle).getBounds();
            return bounds ? bounds.contains(point) : false;
          }

          return google.maps.geometry.poly.containsLocation(
            point,
            shape as google.maps.Polygon,
          );
        })
        .map((property) => property.propertyId);

      onSearchResultChange?.(propertyIds);

      if (type === "circle") {
        const circle = shape as google.maps.Circle;
        const center = circle.getCenter();
        if (center) {
          onSearchCircle?.({
            centerLat: center.lat(),
            centerLng: center.lng(),
            radiusMeters: circle.getRadius(),
          });
        }
        return;
      }

      const coordinates = getPolygonCoordinates(shape, type);
      if (coordinates.length >= 3) {
        onSearchPolygon?.({ coordinates });
      }
    },
    [getPolygonCoordinates, onSearchCircle, onSearchPolygon, onSearchResultChange, properties],
  );

  const styleSearchShape = useCallback(
    (
      shape:
        | google.maps.Polygon
        | google.maps.Rectangle
        | google.maps.Circle,
      type: DrawSearchShapeType,
    ) => {
      const sharedStyle = {
        draggable: true,
        editable: true,
        strokeColor: "#2563eb",
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: "#2563eb",
        fillOpacity: 0.16,
      };

      if (type === "polygon") {
        (shape as google.maps.Polygon).setOptions(sharedStyle);
        return;
      }

      if (type === "rectangle") {
        (shape as google.maps.Rectangle).setOptions(sharedStyle);
        return;
      }

      (shape as google.maps.Circle).setOptions(sharedStyle);
    },
    [],
  );

  const attachSearchShapeListeners = useCallback(
    (
      shape:
        | google.maps.Polygon
        | google.maps.Rectangle
        | google.maps.Circle,
      type: DrawSearchShapeType,
    ) => {
      clearSearchShapeListeners();

      if (type === "polygon") {
        const polygon = shape as google.maps.Polygon;
        const path = polygon.getPath();
        searchShapeListenersRef.current = [
          path.addListener("insert_at", () =>
            updateSearchResultFromShape(polygon, type),
          ),
          path.addListener("set_at", () =>
            updateSearchResultFromShape(polygon, type),
          ),
          path.addListener("remove_at", () =>
            updateSearchResultFromShape(polygon, type),
          ),
          polygon.addListener("dragend", () =>
            updateSearchResultFromShape(polygon, type),
          ),
        ];
        return;
      }

      if (type === "rectangle") {
        const rectangle = shape as google.maps.Rectangle;
        searchShapeListenersRef.current = [
          rectangle.addListener("bounds_changed", () =>
            updateSearchResultFromShape(rectangle, type),
          ),
          rectangle.addListener("dragend", () =>
            updateSearchResultFromShape(rectangle, type),
          ),
        ];
        return;
      }

      const circle = shape as google.maps.Circle;
      searchShapeListenersRef.current = [
        circle.addListener("center_changed", () =>
          updateSearchResultFromShape(circle, type),
        ),
        circle.addListener("radius_changed", () =>
          updateSearchResultFromShape(circle, type),
        ),
        circle.addListener("dragend", () =>
          updateSearchResultFromShape(circle, type),
        ),
      ];
    },
    [clearSearchShapeListeners, updateSearchResultFromShape],
  );

  const clearSearchShape = useCallback(
    (notify = true) => {
      clearSearchShapeListeners();
      if (searchShapeRef.current) {
        searchShapeRef.current.setMap(null);
        searchShapeRef.current = null;
      }
      setDrawnSearchShape(null);
      if (notify) {
        onSearchResultChange?.(null);
        onSearchClear?.();
      }
    },
    [clearSearchShapeListeners, onSearchClear, onSearchResultChange],
  );

  const getDrawingModeForSearch = useCallback(
    (mode: MapSearchMode) => {
      if (!window.google?.maps?.drawing) return null;

      switch (mode) {
        case "polygon":
          return google.maps.drawing.OverlayType.POLYGON;
        case "rectangle":
          return google.maps.drawing.OverlayType.RECTANGLE;
        case "circle":
          return google.maps.drawing.OverlayType.CIRCLE;
        default:
          return null;
      }
    },
    [],
  );

  const handleSearchClear = useCallback(() => {
    clearSearchShape(true);
    const drawingMode = getDrawingModeForSearch(normalizedSearchMode);
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(drawingMode);
    }
  }, [clearSearchShape, getDrawingModeForSearch, normalizedSearchMode]);

  const handlePinMapClick = useCallback((latLng: google.maps.LatLng) => {
    if (!map) return;

    const lat = latLng.lat();
    const lng = latLng.lng();
    const label = String.fromCharCode(65 + pinnedLocations.length); // A, B, C, etc.

    // Create pin marker
    const pinMarker = new google.maps.Marker({
      position: { lat, lng },
      map,
      label: {
        text: label,
        color: 'white',
        fontSize: '14px',
        fontWeight: 'bold',
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#EF4444',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
      draggable: true,
      animation: google.maps.Animation.DROP,
    });
    // Update position on drag
    pinMarker.addListener('dragend', () => {
      // Need to re-fetch latest state references inside the listener or use functional updates carefully.
      // For simplicity here, we trigger a re-calculation based on current markers array in state
      // But since markers array in state is stale inside this closure, we rely on the visual map markers for the line update
      // triggering the update logic via state set is safer:
      
      const newPos = pinMarker.getPosition();
      if(newPos) {
           // We need to update the pinnedLocations state to trigger a re-render and line update
           setPinnedLocations(prev => {
                const idx = pinMarkers.indexOf(pinMarker); // This might be stale, but the logic below handles the "update line" using the marker objects themselves
                const newLocs = [...prev];
                if(idx !== -1 && newLocs[idx]) {
                    newLocs[idx] = { ...newLocs[idx], lat: newPos.lat(), lng: newPos.lng() };
                }
                return newLocs;
           });
      }
    });

    const newPinnedLocations = [...pinnedLocations, { lat, lng, label }];
    const newPinMarkers = [...pinMarkers, pinMarker];

    setPinnedLocations(newPinnedLocations);
    setPinMarkers(newPinMarkers);

    // Draw distance line if we have 2+ pins
    if (newPinnedLocations.length >= 2) {
      updateDistanceLine(newPinnedLocations, newPinMarkers);
    }
  }, [map, pinnedLocations, pinMarkers, updateDistanceLine]);

  // Effect to handle drag updates for the line specifically
  useEffect(() => {
     if(pinMarkers.length > 1) {
         updateDistanceLine(pinnedLocations, pinMarkers);
     }
  }, [pinnedLocations, pinMarkers, updateDistanceLine]);

  // Clear all pins
  const clearPins = useCallback(() => {
  pinMarkers.forEach(marker => marker.setMap(null));
  
  // Use REF
  if (distanceLineRef.current) {
    distanceLineRef.current.setMap(null);
    distanceLineRef.current = null;
  }
  
  setPinMarkers([]);
  setPinnedLocations([]);
  setTotalDistance(0);
}, [pinMarkers]); // Removed distanceLine dependency

  // Toggle pin mode
  const togglePinMode = useCallback(() => {
    if (normalizedSearchMode !== "none") return;
    const newMode = !isPinMode;
    setIsPinMode(newMode);

    if (!newMode) {
      clearPins();
    }
  }, [clearPins, isPinMode, normalizedSearchMode]);

  useEffect(() => {
    if (!map) return;
    const useCrosshair = normalizedSearchMode !== "none" || isPinMode;
    map.setOptions({
      draggableCursor: useCrosshair ? "crosshair" : null,
      streetViewControl: true,
      streetViewControlOptions: {
        position: window.google?.maps?.ControlPosition?.RIGHT_TOP,
      },
    });
  }, [map, normalizedSearchMode, isPinMode]);

  useEffect(() => {
    if (normalizedSearchMode === "none" || !isPinMode) return;
    setIsPinMode(false);
    clearPins();
  }, [clearPins, isPinMode, normalizedSearchMode]);

  // Add click listener to base map for Pin Mode
  useEffect(() => {
    if (!map) return;

    const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      if (isPinMode) {
        handlePinMapClick(e.latLng);
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [
    map,
    isPinMode,
    handlePinMapClick,
  ]);

  useEffect(() => {
    if (!map || !window.google?.maps?.drawing) return;

    if (!drawingManagerRef.current) {
      const drawingManager = new google.maps.drawing.DrawingManager({
        drawingControl: false,
        map,
        polygonOptions: {
          clickable: false,
          draggable: true,
          editable: true,
          strokeColor: "#2563eb",
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: "#2563eb",
          fillOpacity: 0.16,
        },
        rectangleOptions: {
          clickable: false,
          draggable: true,
          editable: true,
          strokeColor: "#2563eb",
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: "#2563eb",
          fillOpacity: 0.16,
        },
        circleOptions: {
          clickable: false,
          draggable: true,
          editable: true,
          strokeColor: "#2563eb",
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: "#2563eb",
          fillOpacity: 0.16,
        },
      });

      drawingManager.addListener(
        "overlaycomplete",
        (event: google.maps.drawing.OverlayCompleteEvent) => {
        const overlayType = event.type;
        let type: DrawSearchShapeType | null = null;

        if (overlayType === google.maps.drawing.OverlayType.POLYGON) {
          type = "polygon";
        } else if (overlayType === google.maps.drawing.OverlayType.RECTANGLE) {
          type = "rectangle";
        } else if (overlayType === google.maps.drawing.OverlayType.CIRCLE) {
          type = "circle";
        }

        if (!type) {
          (
            event.overlay as
              | google.maps.Polygon
              | google.maps.Rectangle
              | google.maps.Circle
          ).setMap(null);
          return;
        }

        clearSearchShape(false);
        const overlay = event.overlay as
          | google.maps.Polygon
          | google.maps.Rectangle
          | google.maps.Circle;
        searchShapeRef.current = overlay;
        styleSearchShape(overlay, type);
        attachSearchShapeListeners(overlay, type);
        setDrawnSearchShape({ type });
        updateSearchResultFromShape(overlay, type);
        drawingManager.setDrawingMode(null);
        },
      );

      drawingManagerRef.current = drawingManager;
    }

    drawingManagerRef.current.setMap(map);
    drawingManagerRef.current.setDrawingMode(
      getDrawingModeForSearch(normalizedSearchMode),
    );

    return () => {
      drawingManagerRef.current?.setMap(null);
    };
  }, [
    attachSearchShapeListeners,
    clearSearchShape,
    getDrawingModeForSearch,
    map,
    normalizedSearchMode,
    styleSearchShape,
    updateSearchResultFromShape,
  ]);

  useEffect(() => {
    if (normalizedSearchMode === "none") {
      clearSearchShape(false);
    }
  }, [clearSearchShape, normalizedSearchMode]);

  useEffect(() => {
    if (searchResetToken === lastSearchResetTokenRef.current) return;
    lastSearchResetTokenRef.current = searchResetToken;
    clearSearchShape(false);
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(
        getDrawingModeForSearch(normalizedSearchMode),
      );
    }
  }, [clearSearchShape, getDrawingModeForSearch, normalizedSearchMode, searchResetToken]);

  useEffect(() => {
    if (!hoveredProperty) return;
    const isStillVisible = displayedProperties.some(
      (property) => property.propertyId === hoveredProperty.propertyId,
    );
    if (!isStillVisible) {
      setHoveredProperty(null);
    }
  }, [displayedProperties, hoveredProperty]);


  // Fetch administrative data
  const { data: provinces } = useProvinces();
  const { data: districts } = useDistrictsByProvinceCode(addressFilter.provinceId);
  const { data: communes } = useCommunesByDistrictCode(addressFilter.districtId);
  const { data: villages } = useVillagesByCommuneCode(addressFilter.communeId);


  // Render GeoJSON boundaries
  const renderLayer = useCallback((data: any[], type: string, color: string, stroke: string) => {
    if (!map || !data || !showGISLayers) return;

    // Clear existing layers
    map.data.forEach((f: google.maps.Data.Feature) => map.data.remove(f));

    if (data.length === 0) return;

    const features = data
      .filter((item) => item.boundary)
      .map((item) => ({
        type: "Feature",
        geometry: item.boundary,
        properties: {
          code: item.code,
          nameEn: item.nameEn,
          nameKh: item.nameKh,
          type: type,
        },
      }));

    if (features.length > 0) {
      map.data.addGeoJson({ type: "FeatureCollection", features });

      map.data.setStyle({
        fillColor: color,
        fillOpacity: type === "province" ? 0.15 : 0.35,
        strokeWeight: 2,
        strokeColor: stroke,
        clickable: true,
      });
    }
  }, [map, showGISLayers]);

  const handleMapReady = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    setIsMapLoading(false);
  }, []);

  const handlePlacesReady = useCallback(() => {
    setPlacesReady(true);
  }, []);

  useEffect(() => {
    if (!map) return;

    const zoomListener = map.addListener("zoom_changed", () => {
      const zoom = map.getZoom() || 7;
      setCurrentZoom(zoom);
    });

    const streetView = map.getStreetView();
    const streetViewListener = streetView.addListener("visible_changed", () => {
      const isVisible = streetView.getVisible();
      setIsInStreetView(isVisible);

      if (isVisible && !showStreetViewLayer) {
        const layer = new google.maps.StreetViewCoverageLayer();
        layer.setMap(map);
        streetViewLayerRef.current = layer;
      } else if (!isVisible && streetViewLayerRef.current && !showStreetViewLayer) {
        streetViewLayerRef.current.setMap(null);
        streetViewLayerRef.current = null;
      }
    });

    return () => {
      google.maps.event.removeListener(zoomListener);
      google.maps.event.removeListener(streetViewListener);
    };
  }, [map, showStreetViewLayer]);
  
  // Handle GIS Layer Interactions (Click & Hover)
useEffect(() => {
  if (!map || !enableGISBoundaries) return;

  // 1. Setup InfoWindow for Tooltips
  const tooltip = new google.maps.InfoWindow({
    disableAutoPan: true,
    content: "",
    pixelOffset: new google.maps.Size(0, -15),
    zIndex: 9999,
  });

  // 2. Click Handler
  const clickListener = map.data.addListener("click", (event: google.maps.Data.MouseEvent) => {
    if (normalizedSearchMode !== "none") return;
    // Handle Pinning (Priority 1)
    if (isPinMode && event.latLng) {
      handlePinMapClick(event.latLng);
      return; // Stop here if pinning
    }

    // Handle Filtering (Priority 2)
    if (onAddressFilterChange) {
      const code = event.feature.getProperty("code") as string;
      const type = event.feature.getProperty("type") as string;
      const newFilter = { ...addressFilter };

      switch(type) {
        case "province":
          newFilter.provinceId = code;
          newFilter.districtId = null;
          newFilter.communeId = null;
          newFilter.villageId = null;
          break;
        case "district":
          newFilter.districtId = code;
          newFilter.communeId = null;
          newFilter.villageId = null;
          break;
        case "commune":
          newFilter.communeId = code;
          newFilter.villageId = null;
          break;
        case "village":
          newFilter.villageId = code;
          break;
      }
      const isSameFilter =
        newFilter.provinceId === addressFilter.provinceId &&
        newFilter.districtId === addressFilter.districtId &&
        newFilter.communeId === addressFilter.communeId &&
        newFilter.villageId === addressFilter.villageId;

      if (!isSameFilter) {
        onAddressFilterChange(newFilter);
      }
    }
  });

  // 3. Hover Handlers
  const mouseOverListener = map.data.addListener("mouseover", (event: google.maps.Data.MouseEvent) => {
    if (normalizedSearchMode !== "none" || isPinMode) return; // Don't show GIS tooltips while searching or measuring

    map.data.overrideStyle(event.feature, {
      fillOpacity: 0.6,
      strokeWeight: 3,
      zIndex: 10,
      cursor: "pointer"
    });

    const nameKh = event.feature.getProperty("nameKh");
    const nameEn = event.feature.getProperty("nameEn");
    
    // Simple tooltip content
    tooltip.setContent(`
      <div style="padding: 4px 8px; font-family: sans-serif;">
        <div style="font-weight: bold;">${nameKh || nameEn}</div>
        ${nameKh && nameEn ? `<div style="font-size: 10px; color: #666;">${nameEn}</div>` : ''}
      </div>
    `);
    
    tooltip.setPosition(event.latLng);
    tooltip.open(map);
  });

  const mouseMoveListener = map.data.addListener("mousemove", (event: google.maps.Data.MouseEvent) => {
    if (normalizedSearchMode !== "none" || isPinMode) return;
    tooltip.setPosition(event.latLng);
  });

  const mouseOutListener = map.data.addListener("mouseout", () => {
    map.data.revertStyle();
    tooltip.close();
  });

  // Cleanup: Remove listeners when modes change to prevent duplicates
  return () => {
    google.maps.event.removeListener(clickListener);
    google.maps.event.removeListener(mouseOverListener);
    google.maps.event.removeListener(mouseMoveListener);
    google.maps.event.removeListener(mouseOutListener);
    tooltip.close();
  };
}, [map, enableGISBoundaries, normalizedSearchMode, isPinMode, addressFilter, onAddressFilterChange, handlePinMapClick]);


  // Create markers when map and properties are ready
  useEffect(() => {
    if (!map) return;
    markers.forEach(marker => {
      marker.map = null;
    });
    if (markerClusterer) markerClusterer.setMap(null);
    if (!markerEntries.length) {
      setMarkers([]);
      setMarkerClusterer(null);
      return;
    }
    const newMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
    markerEntries.forEach(({ id, layer, property, position }) => {
      const propertyTypeName =
        property.propertyType?.propertyName ||
        property.propertyType?.recordType?.recordName;
      const pin = getAdvancedMarkerPin(property.status, 1, {
        hasValuation: property.hasValuation,
        hasIndicativeValuation: property.hasIndicativeValuation,
        propertyTypeName,
      });
      const layerOffset = MARKER_LAYER_PIXEL_OFFSETS[layer];
      pin.style.transform = `translate(${layerOffset.x}px, ${layerOffset.y}px)`;
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position,
        map,
        title: `${property.propertyName} (${layer})`,
        content: pin,
        gmpClickable: true,
        zIndex: MARKER_LAYER_Z_INDEX[layer],
      });
      const handleMarkerClick: EventListener = () => {
        if (activeInfoWindowRef.current) {
          activeInfoWindowRef.current.close();
        }
        if (marker.position) {
          map.panTo(marker.position as google.maps.LatLng | google.maps.LatLngLiteral);
        }
        const viewDetailsCallback = `(function(){window.dispatchEvent(new CustomEvent('propertyMarkerClick',{detail:{propertyId:${property.propertyId}}}));})()`;
        const infoWindow = new google.maps.InfoWindow({
          content: createInfoWindowContent(
            property,
            viewDetailsCallback,
            locale,
          ),
          maxWidth: 300,
        });
        infoWindow.open({ map, anchor: marker });
        activeInfoWindowRef.current = infoWindow;
      };
      marker.addListener("mouseover", () => setHoveredProperty(property));
      marker.addListener("mouseout", () => setHoveredProperty(null));
      marker.addListener("mouseover", () => {
        const hoverPin = getAdvancedMarkerPin(property.status, 1.15, {
          hasValuation: property.hasValuation,
          hasIndicativeValuation: property.hasIndicativeValuation,
          propertyTypeName,
        });
        hoverPin.style.transform = `translate(${layerOffset.x}px, ${layerOffset.y}px)`;
        marker.content = hoverPin;
      });
      marker.addListener("mouseout", () => {
        const normalPin = getAdvancedMarkerPin(property.status, 1, {
          hasValuation: property.hasValuation,
          hasIndicativeValuation: property.hasIndicativeValuation,
          propertyTypeName,
        });
        normalPin.style.transform = `translate(${layerOffset.x}px, ${layerOffset.y}px)`;
        marker.content = normalPin;
      });
      marker.addEventListener("gmp-click", handleMarkerClick);
      newMarkers.push(marker);
    });
    setMarkers(newMarkers);
    if (enableClustering && newMarkers.length > 20) {
      const clusterer = new MarkerClusterer({
        map,
        markers: newMarkers,
        algorithm: new GridAlgorithm({ maxZoom: 18 }),
        onClusterClick: (_event, cluster: Cluster, clusterMap: google.maps.Map) => {
          if (!cluster.bounds) return;
          clusterMap.fitBounds(cluster.bounds, { top: 80, right: 80, bottom: 80, left: 80 });
          google.maps.event.addListenerOnce(clusterMap, "idle", () => {
            const zoom = clusterMap.getZoom();
            if (zoom && zoom > MAX_AUTO_ZOOM) {
              clusterMap.setZoom(MAX_AUTO_ZOOM);
            }
          });
        },
      });
      setMarkerClusterer(clusterer);
    }
    fitMapToBounds(map, newMarkers);
  }, [map, markerEntries, displayedProperties, enableClustering, locale, googleMapsApiKey]);

  // Listen for property marker click events from info window
  useEffect(() => {
    const handlePropertyClick = (event: Event) => {
      const customEvent = event as CustomEvent<{ propertyId: number }>;
      if (onPropertyClick && customEvent.detail?.propertyId) {
        onPropertyClick(customEvent.detail.propertyId);
      }
    };

    window.addEventListener('propertyMarkerClick', handlePropertyClick);
    return () => window.removeEventListener('propertyMarkerClick', handlePropertyClick);
  }, [onPropertyClick]);

  // Update map type
  useEffect(() => {
    if (map) {
      map.setMapTypeId(mapType);
    }
  }, [mapType, map]);

  // Initialize Search Box
  useEffect(() => {
    if (!map || !showSearchBox || !searchInputRef.current || !placesReady) return;

    const timer = setTimeout(() => {
      if (!searchInputRef.current) return;

      const searchBox = new google.maps.places.SearchBox(searchInputRef.current);
      searchBoxRef.current = searchBox;

      const boundsListener = map.addListener("bounds_changed", () => {
        const bounds = map.getBounds();
        if (bounds) searchBox.setBounds(bounds);
      });

      const placesListener = searchBox.addListener("places_changed", () => {
        const places = searchBox.getPlaces();
        if (!places || places.length === 0) return;

        const place = places[0];
        if (!place.geometry || !place.geometry.location) return;

        const location = place.geometry.location;

        if (place.geometry.viewport) {
          map.fitBounds(place.geometry.viewport);
          google.maps.event.addListenerOnce(map, "idle", () => {
            const zoom = map.getZoom();
            if (zoom && zoom > MAX_AUTO_ZOOM) {
              map.setZoom(MAX_AUTO_ZOOM);
            }
          });
        } else {
          map.setCenter(location);
          map.setZoom(PLACE_FALLBACK_ZOOM);
        }

        setSearchQuery("");
        setShowSearchBox(false);
      });

      return () => {
        google.maps.event.removeListener(boundsListener);
        google.maps.event.removeListener(placesListener);
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [map, showSearchBox, placesReady]);

  // Render property shapes - controlled by zoom level OR manual toggle
  useEffect(() => {
    if (!map) return;

    // Determine if shapes should be shown
    const shouldShowShapes = alwaysShowShapes || currentZoom > 15;

    if (!shouldShowShapes) {
      // Clear all property shapes
      propertyShapes.forEach(shape => shape.setMap(null));
      setPropertyShapes(new Map());
      setShapesVisible(false);
      return;
    }

    // Show property shapes
    const newShapes = new Map<number, google.maps.Polygon>();
    let visibleShapesCount = 0;

    displayedProperties.forEach(property => {
      // Check if property has boundary data
      if (property.polygon && typeof property.polygon === 'object') {
        try {
          let paths: google.maps.LatLngLiteral[] = [];

          // Handle GeoJSON Polygon format
          if (property.polygon.type === "Polygon" && property.polygon.coordinates) {
            paths = property.polygon.coordinates[0].map((coord: number[]) => ({
              lat: coord[1],
              lng: coord[0],
            }));
          }

          if (paths.length > 0) {
            const isHovered = hoveredProperty?.propertyId === property.propertyId;

            const polygon = new google.maps.Polygon({
              paths,
              map,
              fillColor: property.status === 'active' ? '#10b981' :
                         property.status === 'pending' ? '#f59e0b' : '#6b7280',
              fillOpacity: isHovered ? 0.5 : 0.3,
              strokeColor: property.status === 'active' ? '#059669' :
                          property.status === 'pending' ? '#d97706' : '#4b5563',
              strokeWeight: isHovered ? 3 : 2,
              clickable: true,
              zIndex: isHovered ? 10 : 1,
            });

            polygon.addListener('click', () => {
              if (onPropertyClick) {
                onPropertyClick(property.propertyId);
              }
            });

            polygon.addListener('mouseover', () => {
              polygon.setOptions({
                fillOpacity: 0.5,
                strokeWeight: 3,
                zIndex: 10,
              });
              setHoveredProperty(property);
            });

            polygon.addListener('mouseout', () => {
              polygon.setOptions({
                fillOpacity: 0.3,
                strokeWeight: 2,
                zIndex: 1,
              });
              setHoveredProperty(null);
            });

            newShapes.set(property.propertyId, polygon);
            visibleShapesCount++;
          }
        } catch (error) {
          console.error('Error rendering property boundary:', error);
        }
      }
    });

    // Clear old shapes that are no longer needed
    propertyShapes.forEach((shape, id) => {
      if (!newShapes.has(id)) {
        shape.setMap(null);
      }
    });

    setPropertyShapes(newShapes);
    setShapesVisible(visibleShapesCount > 0);
  }, [map, displayedProperties, currentZoom, onPropertyClick, alwaysShowShapes, hoveredProperty]);

  // Toggle Street View Layer
  const toggleStreetViewLayer = useCallback(() => {
    if (!map) return;
    if (!showStreetViewLayer) {
      const layer = new google.maps.StreetViewCoverageLayer();
      layer.setMap(map);
      streetViewLayerRef.current = layer;
      setShowStreetViewLayer(true);
    } else {
      if (streetViewLayerRef.current) {
        streetViewLayerRef.current.setMap(null);
        streetViewLayerRef.current = null;
      }
      setShowStreetViewLayer(false);
    }
  }, [map, showStreetViewLayer]);

  // Render GIS boundaries based on current filter level
 useEffect(() => {
    if (!map || !showGISLayers) return;
    if (villages && villages.length > 0 && addressFilter.communeId) {
      renderLayer(villages, "village", "#404143ff", "#404143ff");
    } else if (communes && communes.length > 0 && addressFilter.districtId) {
      renderLayer(communes, "commune", "#9C27B0", "#7B1FA2");
    } else if (districts && districts.length > 0 && addressFilter.provinceId) {
      renderLayer(districts, "district", "#FF9800", "#F57C00");
    } else if (provinces && provinces.length > 0) {
      renderLayer(provinces, "province", "#0F9D58", "#0F9D58");
    }
  }, [map, showGISLayers, provinces, districts, communes, villages, addressFilter, renderLayer]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleZoomIn = () => map && map.setZoom((map.getZoom() || 7) + 1);
  const handleZoomOut = () => map && map.setZoom((map.getZoom() || 7) - 1);
  const handleRecenter = () => map && markers.length > 0 && fitMapToBounds(map, markers);

  const handleFullscreenToggle = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch((err) => console.error(err));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  return (
    <>
      <style jsx global>{`
        .property-map-native-pegman .gm-style .gm-svpc {
          margin-top: 252px !important;
          margin-right: 16px !important;
          z-index: 25 !important;
        }
      `}</style>
      <div
        ref={containerRef}
        className={`property-map-native-pegman relative w-full rounded-xl overflow-hidden shadow-2xl border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 ${
          isFullscreen ? 'fixed inset-0 z-[9999] rounded-none' : ''
        }`}
      >
      {isMapLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 z-50 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
          <p className="text-sm font-semibold text-gray-700">Loading Property Map...</p>
        </div>
      )}

      {/* Map Container */}
      <div style={{ width: "100%", height: isFullscreen ? "100vh" : height }}>
        <APIProvider apiKey={googleMapsApiKey} libraries={["geometry", "marker", "drawing"]}>
          <GoogleMap
            mapId={googleMapsMapId || undefined}
            defaultCenter={{ lat: 11.5564, lng: 104.9282 }}
            defaultZoom={12}
            mapTypeId={mapType}
            mapTypeControl={false}
            streetViewControl={true}
            zoomControl={false}
            fullscreenControl={false}
            gestureHandling="greedy"
            style={{ width: "100%", height: "100%" }}
          >
            <MapBridge onMapReady={handleMapReady} onPlacesReady={handlePlacesReady} />
          </GoogleMap>
        </APIProvider>
      </div>

      {/* Search Box */}
      {placesReady && showSearchBox && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for places, addresses..."
              autoComplete="off"
              className="w-full pl-10 pr-10 py-3 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <button
              onClick={() => {
                setShowSearchBox(false);
                setSearchQuery("");
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close Search"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>
      )}
      
      {/* Measurement Info Panel (Top Center/Left) */}
      {isPinMode && (
         <div className="absolute top-20 left-4 z-30 flex flex-col gap-2">
            <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border-2 border-red-100 p-3 w-48 animate-in slide-in-from-left-2">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-red-500" />
                        <span className="text-xs font-bold text-gray-800">Measure</span>
                    </div>
                    {pinnedLocations.length > 0 && (
                        <button 
                            onClick={clearPins}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                            title="Clear Pins"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    )}
                </div>
                
                <div className="text-sm font-bold text-gray-900 mb-1">
                    {totalDistance.toFixed(2)} km
                </div>
                <div className="text-[10px] text-gray-500">
                    {pinnedLocations.length === 0 ? "Click map to add start point" : 
                     pinnedLocations.length === 1 ? "Click to add end point" : 
                     `${pinnedLocations.length} points • Drag to adjust`}
                </div>
            </div>
         </div>
      )}

      {/* Draw Search Panel */}
      {onSearchModeChange && (
        <div className="absolute top-20 left-4 z-30 pointer-events-auto max-w-[calc(100%-2rem)] sm:max-w-[320px]">
          <div className="bg-white/96 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-gray-700" />
              <div className="text-xs font-bold text-gray-900">Draw Search</div>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() =>
                    onSearchModeChange(
                      normalizedSearchMode === "polygon" ? "none" : "polygon",
                    )
                  }
                  className={`px-2.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                    normalizedSearchMode === "polygon"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Pentagon className="h-4 w-4" />
                  Polygon
                </button>
                <button
                  onClick={() =>
                    onSearchModeChange(
                      normalizedSearchMode === "rectangle" ? "none" : "rectangle",
                    )
                  }
                  className={`px-2.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                    normalizedSearchMode === "rectangle"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Square className="h-4 w-4" />
                  Rect
                </button>
                <button
                  onClick={() =>
                    onSearchModeChange(
                      normalizedSearchMode === "circle" ? "none" : "circle",
                    )
                  }
                  className={`px-2.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                    normalizedSearchMode === "circle"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <CircleIcon className="h-4 w-4" />
                  Circle
                </button>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/90 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-blue-900">
                  {normalizedSearchMode === "none"
                    ? "Choose a shape to start drawing."
                    : drawnSearchShape
                      ? "Drag or edit the shape to update matching properties."
                      : "Draw one shape on the map to filter properties inside it."}
                </p>
                {drawnSearchShape && (
                  <p className="mt-1 text-[10px] text-blue-700 capitalize">
                    Active shape: {drawnSearchShape.type}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSearchClear}
                  disabled={!drawnSearchShape}
                  className={`flex-1 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    drawnSearchShape
                      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Clear Shape
                </button>
                <button
                  onClick={() => onSearchModeChange("none")}
                  disabled={normalizedSearchMode === "none" && !drawnSearchShape}
                  className={`flex-1 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    normalizedSearchMode !== "none" || drawnSearchShape
                      ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Exit Draw
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Type Switcher */}
      <div className="absolute top-4 right-4 z-20 flex w-[184px] flex-col gap-3">
        {/* Property Shapes Toggle */}
        {displayedProperties.some(p => p.polygon) && (
          <button
            onClick={() => setAlwaysShowShapes(!alwaysShowShapes)}
            className={`w-full px-4 py-3 text-xs font-semibold rounded-2xl shadow-xl border transition-all ${
              alwaysShowShapes
                ? "bg-emerald-600 text-white border-emerald-700"
                : "bg-white/95 backdrop-blur-md text-gray-700 border-slate-200 hover:bg-slate-50"
            }`}
            title={alwaysShowShapes ? "Auto Show Shapes (zoom-based)" : "Always Show Property Shapes"}
          >
            <svg
              className="h-3.5 w-3.5 inline mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            {alwaysShowShapes ? "Auto" : "Show"} Shapes
            {shapesVisible && (
              <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-[9px]">
                {propertyShapes.size}
              </span>
            )}
          </button>
        )}

        {/* GIS Boundaries Toggle */}
        {enableGISBoundaries && (
          <button
            onClick={() => setShowGISLayers(!showGISLayers)}
            className={`w-full px-4 py-3 text-xs font-semibold rounded-2xl shadow-xl border transition-all ${
              showGISLayers
                ? "bg-violet-600 text-white border-violet-700"
                : "bg-white/95 backdrop-blur-md text-gray-700 border-slate-200 hover:bg-slate-50"
            }`}
            title={showGISLayers ? "Hide GIS Boundaries" : "Show GIS Boundaries"}
          >
            <Layers className="h-3.5 w-3.5 inline mr-1.5" />
            {showGISLayers ? "Hide" : "Show"} Boundaries
          </button>
        )}

        <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white/95 shadow-xl backdrop-blur-md">
          <button
            onClick={() => setMapType("roadmap")}
            className={`w-full px-4 py-2.5 text-xs font-semibold transition-all ${
              mapType === "roadmap"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-slate-50"
            }`}
            title="Road Map"
          >
            Road
          </button>
          <button
            onClick={() => setMapType("satellite")}
            className={`w-full px-4 py-2.5 text-xs font-semibold transition-all border-t border-slate-200 ${
              mapType === "satellite"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-slate-50"
            }`}
            title="Satellite View"
          >
            Satellite
          </button>
          <button
            onClick={() => setMapType("hybrid")}
            className={`w-full px-4 py-2.5 text-xs font-semibold transition-all border-t border-slate-200 ${
              mapType === "hybrid"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-slate-50"
            }`}
            title="Hybrid View"
          >
            Hybrid
          </button>
          <button
            onClick={() => setMapType("terrain")}
            className={`w-full px-4 py-2.5 text-xs font-semibold transition-all border-t border-slate-200 ${
              mapType === "terrain"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-slate-50"
            }`}
            title="Terrain View"
          >
            Terrain
          </button>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="absolute right-4 top-[344px] z-20">
        <div className="flex flex-col gap-2 rounded-[1.25rem] border border-slate-200 bg-white/90 p-2 shadow-xl backdrop-blur-md">
        {/* Search Button */}
        {placesReady && (
          <>
            <button
              onClick={() => setShowSearchBox(!showSearchBox)}
              className={`bg-white p-2.5 rounded-xl border transition-all group ${
                showSearchBox
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-slate-200 hover:bg-blue-50 hover:border-blue-300'
              }`}
              title={showSearchBox ? "Hide Search" : "Search Location"}
            >
              <Search className={`h-5 w-5 ${showSearchBox ? 'text-blue-600' : 'text-gray-700 group-hover:text-blue-600'}`} />
            </button>

            <div className="mx-1 h-px bg-slate-200"></div>
          </>
        )}

        {/* --- ADDED: Measurement Tool Button --- */}
        <button
          onClick={togglePinMode}
          disabled={normalizedSearchMode !== "none"}
          className={`bg-white p-2.5 rounded-xl border transition-all group ${
            isPinMode 
              ? 'border-red-500 bg-red-50 shadow-md' 
              : normalizedSearchMode !== "none"
                ? 'border-slate-200 opacity-50 cursor-not-allowed'
                : 'border-slate-200 hover:bg-red-50 hover:border-red-300'
          }`}
          title={
            normalizedSearchMode !== "none"
              ? "Disable area search to measure"
              : isPinMode
                ? "Exit Measure Mode"
                : "Measure Distance"
          }
        >
          <Ruler className={`h-5 w-5 ${isPinMode ? 'text-red-600' : 'text-gray-700 group-hover:text-red-600'}`} />
        </button>
        
        <div className="mx-1 h-px bg-slate-200"></div>

        <button
          onClick={handleZoomIn}
          className="bg-white p-2.5 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-all group"
          title="Zoom In"
        >
          <ZoomIn className="h-5 w-5 text-gray-700 group-hover:text-blue-600" />
        </button>
        <button
          onClick={handleZoomOut}
          className="bg-white p-2.5 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-all group"
          title="Zoom Out"
        >
          <ZoomOut className="h-5 w-5 text-gray-700 group-hover:text-blue-600" />
        </button>
        <button
          onClick={handleRecenter}
          className="bg-white p-2.5 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-all group"
          title="Recenter Map"
        >
          <Crosshair className="h-5 w-5 text-gray-700 group-hover:text-blue-600" />
        </button>

        {/* Street View Coverage Layer Button */}
        <button
          onClick={toggleStreetViewLayer}
          className={`bg-white p-2.5 rounded-xl border transition-all group ${
            showStreetViewLayer
              ? 'border-cyan-500 bg-cyan-50 shadow-md'
              : 'border-slate-200 hover:bg-cyan-50 hover:border-cyan-300'
          }`}
          title={showStreetViewLayer ? "Hide Street View Coverage" : "Show Street View Coverage"}
        >
          <MapIcon className={`h-5 w-5 ${showStreetViewLayer ? 'text-cyan-600' : 'text-gray-700 group-hover:text-cyan-600'}`} />
        </button>

        {/* Fullscreen Button */}
        <div className="mx-1 h-px bg-slate-200"></div>
        <button
          onClick={handleFullscreenToggle}
          className="bg-white p-2.5 rounded-xl border border-slate-200 hover:bg-purple-50 hover:border-purple-300 transition-all group"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize2 className="h-5 w-5 text-gray-700 group-hover:text-purple-600" />
          ) : (
            <Maximize2 className="h-5 w-5 text-gray-700 group-hover:text-purple-600" />
          )}
        </button>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-4 max-w-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-gray-700" />
              <h3 className="text-sm font-bold text-gray-900">Map Legend</h3>
            </div>
            <button
              onClick={() => setShowLegend(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="font-semibold text-gray-900 mb-1">Property Markers</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-orange-300 shadow"></div>
              <span className="text-gray-700">Valuation Pin</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-red-300 shadow"></div>
              <span className="text-gray-700">Indicative Valuation Pin</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow"></div>
              <span className="text-gray-700">Active Property</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500 border-2 border-white shadow"></div>
              <span className="text-gray-700">Rented Property</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow"></div>
              <span className="text-gray-700">Sold Property</span>
            </div>
            

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500 border-2 border-white shadow"></div>
              <span className="text-gray-700">Inactive Property</span>
            </div>


            {shapesVisible && (
              <>
                <div className="font-semibold text-gray-900 mt-3 mb-1">Property Boundaries</div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500/30 border-2 border-green-600"></div>
                  <span className="text-gray-700">Active Property Area</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-amber-500/30 border-2 border-amber-600"></div>
                  <span className="text-gray-700">Pending Property Area</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gray-500/30 border-2 border-gray-600"></div>
                  <span className="text-gray-700">Inactive Property Area</span>
                </div>
              </>
            )}

            {showGISLayers && (
              <>
                <div className="font-semibold text-gray-900 mt-3 mb-1">GIS Boundaries</div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500/30 border-2 border-green-600"></div>
                  <span className="text-gray-700">Province</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-orange-500/30 border-2 border-orange-600"></div>
                  <span className="text-gray-700">District</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-purple-500/30 border-2 border-purple-600"></div>
                  <span className="text-gray-700">Commune</span>
                </div>
              </>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-3 pt-3 border-t space-y-1">
            <p>• Click markers/shapes to view details</p>
            <p>• Hover over properties for coordinates</p>
            {!alwaysShowShapes && <p>• Toggle "Show Shapes" for boundaries</p>}
            {alwaysShowShapes && <p>• Property shapes always visible</p>}
            {showGISLayers && <p>• Click GIS boundaries to filter</p>}
            <p>• Drag Pegman for Street View</p>
          </div>
        </div>
      )}

      {/* Toggle Legend Button */}
      {!showLegend && (
        <button
          onClick={() => setShowLegend(true)}
          className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-sm p-2.5 rounded-lg shadow-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-all group"
          title="Show Legend"
        >
          <Info className="h-5 w-5 text-gray-700 group-hover:text-blue-600" />
        </button>
      )}

      {/* Coordinates Display (when hovering over property) */}
      {hoveredProperty && (
        <div className="absolute bottom-4 right-4 z-20 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-red-500" />
            <h3 className="text-xs font-bold text-gray-900">{hoveredProperty.propertyName}</h3>
          </div>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Lat:</span>
              <span className="text-gray-900 font-semibold">{hoveredProperty.latitude?.toFixed(6)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Lng:</span>
              <span className="text-gray-900 font-semibold">{hoveredProperty.longitude?.toFixed(6)}</span>
            </div>
            <div className="flex justify-between gap-4 pt-1 border-t">
              <span className="text-gray-500">Status:</span>
              <span className={`font-semibold capitalize ${
                hoveredProperty.status === 'active' ? 'text-green-600' :
                hoveredProperty.status === 'pending' ? 'text-amber-600' : 'text-gray-600'
              }`}>
                {hoveredProperty.status}
              </span>
            </div>
          </div>
        </div>
      )}

      </div>
    </>
  );
}
