"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMap, AdvancedMarker } from "@vis.gl/react-google-maps";
import { createPortal } from "react-dom";
import {
  MapPin,
  Navigation,
  Layers,
  X,
  Crosshair,
  Info,
  Home,
  Building,
  Building2,
  MapPinned,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Search,
  Map as MapIcon,
  Pentagon,
  Square,
  Circle,
  Trash2,
  Edit3,
  Undo2,
} from "lucide-react";

import type { AddressData, DrawnShape, ShapeType } from "@/types/googleMap.types";
import {
  useProvinces,
  useDistrictsByProvinceCode,
  useCommunesByDistrictCode,
  useVillagesByCommuneCode,
} from "@/hooks/usePropertyAddress";
import { useReverseGeocode } from "@/hooks/uselocation";

/** ---------------- Small helpers ---------------- **/
const PegmanIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="12" cy="5" r="2.5" fill="currentColor" />
    <path
      d="M9 22v-7.5c0-1.4 1.1-2.5 2.5-2.5h1c1.4 0 2.5 1.1 2.5 2.5V22h-2v-4h-2v4H9z"
      fill="currentColor"
    />
    <path
      d="M7 9.5c0-1.7 1.3-3 3-3h4c1.7 0 3 1.3 3 3v3h-2v-3c0-.6-.4-1-1-1h-4c-.6 0-1 .4-1 1v3H7v-3z"
      fill="currentColor"
    />
  </svg>
);

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

/** ---------------- GIS helpers ---------------- **/
type GisLayerType = "province" | "district" | "commune" | "village";

const GIS_PALETTE: Record<GisLayerType, { fill: string; stroke: string }> = {
  province: { fill: "#0072B2", stroke: "#003F5C" },
  district: { fill: "#D55E00", stroke: "#8B2E00" },
  commune: { fill: "#E69F00", stroke: "#B37600" },
  village: { fill: "#56B4E9", stroke: "#2C6B8C" },
};

const LAYER_Z: Record<GisLayerType, number> = {
  province: 10,
  district: 20,
  commune: 30,
  village: 40,
};

const isSatelliteLike = (map: google.maps.Map) => {
  const t = map.getMapTypeId();
  return t === "satellite" || t === "hybrid";
};

const safeParseBoundary = (boundary: any) => {
  if (!boundary) return null;
  if (typeof boundary === "string") {
    try {
      return JSON.parse(boundary);
    } catch {
      return null;
    }
  }
  return boundary;
};

const hasRenderableBoundary = (item: any) => {
  const parsed = safeParseBoundary(item?.boundary ?? item?.geom ?? item?.geometry);
  if (!parsed) return false;
  const normalized = normalizeGeoJsonCoords(parsed);
  return Boolean(normalized?.type && normalized?.coordinates);
};

/**
 * IMPORTANT:
 * - Your backend likely returns GeoJSON coordinates in [lng, lat].
 * - If the source is sometimes reversed, this tries to normalize.
 */
const normalizeGeoJsonCoords = (geom: any) => {
  if (!geom?.coordinates) return geom;

  const swap = (pair: any) => [pair[1], pair[0]];
  const looksReversed = (pair: any) => {
    const a = Number(pair?.[0]); // could be lat
    const b = Number(pair?.[1]); // could be lng
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) > 90;
  };

  const walk = (coords: any): any => {
    if (!Array.isArray(coords)) return coords;
    if (coords.length === 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      return looksReversed(coords) ? swap(coords) : coords; // keep [lng,lat] if already correct
    }
    return coords.map(walk);
  };

  return { ...geom, coordinates: walk(geom.coordinates) };
};

const geoJsonToBounds = (geometry: any) => {
  if (!window.google?.maps) return null;
  const bounds = new google.maps.LatLngBounds();

  const extendPair = (pair: [number, number]) => {
    const [lng, lat] = pair;
    if (Number.isFinite(lat) && Number.isFinite(lng)) bounds.extend(new google.maps.LatLng(lat, lng));
  };

  const walk = (coords: any) => {
    if (!Array.isArray(coords)) return;
    if (coords.length === 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      extendPair(coords as any);
      return;
    }
    coords.forEach(walk);
  };

  walk(geometry?.coordinates);
  return bounds.isEmpty() ? null : bounds;
};

const GIS_TYPES = ["province", "district", "commune", "village"] as const;
const DEFAULT_PIN_LATITUDE = 11.5564;
const DEFAULT_PIN_LONGITUDE = 104.9282;

const clearAllGis = (map: google.maps.Map, layerSigRef: React.MutableRefObject<Record<string, string>>) => {
  const rm: google.maps.Data.Feature[] = [];
  map.data.forEach((f) => rm.push(f));
  rm.forEach((f) => map.data.remove(f));

  // ✅ reset all cached signatures
  for (const t of GIS_TYPES) layerSigRef.current[t] = "";
};

const clearGisExcept = (
  map: google.maps.Map,
  keep: GisLayerType[],
  layerSigRef: React.MutableRefObject<Record<string, string>>
) => {
  const keepSet = new Set(keep);

  const rm: google.maps.Data.Feature[] = [];
  const removedTypes = new Set<GisLayerType>();

  map.data.forEach((f) => {
    const t = f.getProperty("layerType") as GisLayerType | undefined;
    if (!t) return;
    if (!keepSet.has(t)) {
      rm.push(f);
      removedTypes.add(t);
    }
  });

  rm.forEach((f) => map.data.remove(f));

  // ✅ reset signatures ONLY for removed types
  removedTypes.forEach((t) => {
    layerSigRef.current[t] = "";
  });
};

/** ---------------- Shape serialization for undo/restore ---------------- **/
type SerializedShape =
  | { id: string; type: "polygon"; ring: google.maps.LatLngLiteral[] }
  | { id: string; type: "rectangle"; ring: google.maps.LatLngLiteral[] }
  | { id: string; type: "circle"; center: google.maps.LatLngLiteral; radius: number };

const polygonPathToRing = (poly: google.maps.Polygon) => {
  const path = poly.getPath();
  const ring: google.maps.LatLngLiteral[] = [];
  for (let i = 0; i < path.getLength(); i++) {
    const p = path.getAt(i);
    ring.push({ lat: p.lat(), lng: p.lng() });
  }
  if (ring.length) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first.lat !== last.lat || first.lng !== last.lng) ring.push(first);
  }
  return ring;
};

const rectangleToRing = (rect: google.maps.Rectangle) => {
  const b = rect.getBounds();
  if (!b) return [];
  const ne = b.getNorthEast();
  const sw = b.getSouthWest();
  const nw = new google.maps.LatLng(ne.lat(), sw.lng());
  const se = new google.maps.LatLng(sw.lat(), ne.lng());
  return [
    { lat: sw.lat(), lng: sw.lng() },
    { lat: se.lat(), lng: se.lng() },
    { lat: ne.lat(), lng: ne.lng() },
    { lat: nw.lat(), lng: nw.lng() },
    { lat: sw.lat(), lng: sw.lng() },
  ];
};

/** ---------------- UI (small, replace with your fancy UI if you want) ---------------- **/
const SearchBoxUI = React.memo(function SearchBoxUI(props: {
  show: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { show, value, onChange, onClose, inputRef } = props;
  if (!show) return null;
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4 pointer-events-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search for places…"
          autoComplete="off"
          className="w-full pl-10 pr-10 py-3 bg-white/95 rounded-lg shadow-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <button
          onClick={onClose}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded-lg"
          title="Close"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
});

const ToastUI = React.memo(function ToastUI(props: {
  toast: { message: string; type: "success" | "error" | "info" } | null;
}) {
  const { toast } = props;
  if (!toast) return null;
  const cls =
    toast.type === "success"
      ? "bg-green-50 border-green-400 text-green-900"
      : toast.type === "error"
      ? "bg-red-50 border-red-400 text-red-900"
      : "bg-blue-50 border-blue-400 text-blue-900";
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div className={`px-5 py-3 rounded-lg shadow-xl border ${cls}`}>
        <span className="font-semibold text-sm">{toast.message}</span>
      </div>
    </div>
  );
});

const RightControlsUI = React.memo(function RightControlsUI(props: {
  canUsePlacesSearch: boolean;
  showSearchBox: boolean;
  onToggleSearch: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  onPegman: () => void;
  onToggleStreetLayer: () => void;
  showStreetViewLayer: boolean;
  isInStreetView: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const {
    canUsePlacesSearch,
    showSearchBox,
    onToggleSearch,
    onZoomIn,
    onZoomOut,
    onRecenter,
    onPegman,
    onToggleStreetLayer,
    showStreetViewLayer,
    isInStreetView,
    isFullscreen,
    onToggleFullscreen,
  } = props;

  const Btn = ({ onClick, title, children }: any) => (
    <button
      onClick={onClick}
      title={title}
      className="bg-white/95 p-2.5 rounded-lg shadow-lg border border-gray-200 hover:bg-blue-50"
    >
      {children}
    </button>
  );

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2 pointer-events-auto">
      {canUsePlacesSearch && (
        <>
          <Btn onClick={onToggleSearch} title={showSearchBox ? "Hide Search" : "Search"}>
            <Search className="h-5 w-5 text-gray-700" />
          </Btn>

          <div className="h-px bg-gray-300 my-1" />
        </>
      )}

      <Btn onClick={onZoomIn} title="Zoom In">
        <ZoomIn className="h-5 w-5 text-gray-700" />
      </Btn>
      <Btn onClick={onZoomOut} title="Zoom Out">
        <ZoomOut className="h-5 w-5 text-gray-700" />
      </Btn>
      <Btn onClick={onRecenter} title="Recenter">
        <Crosshair className="h-5 w-5 text-gray-700" />
      </Btn>

      <Btn onClick={onPegman} title={isInStreetView ? "Exit Street View" : "Street View at pin"}>
        <PegmanIcon className="h-5 w-5 text-gray-700" />
      </Btn>

      <button
        onClick={onToggleStreetLayer}
        title={showStreetViewLayer ? "Hide Street coverage" : "Show Street coverage"}
        className={`bg-white/95 p-2.5 rounded-lg shadow-lg border ${
          showStreetViewLayer ? "border-cyan-400 bg-cyan-50" : "border-gray-200 hover:bg-cyan-50"
        }`}
      >
        <MapIcon className="h-5 w-5 text-gray-700" />
      </button>

      <div className="h-px bg-gray-300 my-1" />

      <Btn onClick={onToggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
        {isFullscreen ? <Minimize2 className="h-5 w-5 text-gray-700" /> : <Maximize2 className="h-5 w-5 text-gray-700" />}
      </Btn>
    </div>
  );
});

const MapTypeSwitcherUI = React.memo(function MapTypeSwitcherUI(props: {
  mapType: "roadmap" | "satellite" | "hybrid" | "terrain";
  onChange: (t: "roadmap" | "satellite" | "hybrid" | "terrain") => void;
}) {
  const { mapType, onChange } = props;
  return (
    <div className="absolute top-4 right-4 z-30 pointer-events-auto">
      <div className="bg-white/95 rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {(["roadmap", "satellite", "hybrid", "terrain"] as const).map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`w-full px-4 py-2 text-xs font-semibold border-t first:border-t-0 ${
              mapType === t ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
});

const LegendUI = React.memo(function LegendUI(props: { show: boolean; onToggle: () => void }) {
  const { show, onToggle } = props;
  return show ? (
    <div className="absolute bottom-4 left-4 z-30 bg-white/95 rounded-lg shadow-lg border border-gray-200 p-4 pointer-events-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-gray-700" />
          <div className="text-sm font-bold">Legend</div>
        </div>
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2 text-xs">
        {(["province", "district", "commune", "village"] as GisLayerType[]).map((k) => (
          <div key={k} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded border-2"
              style={{ background: GIS_PALETTE[k].fill + "33", borderColor: GIS_PALETTE[k].stroke }}
            />
            <span className="capitalize">{k}</span>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <button
      onClick={onToggle}
      className="absolute bottom-4 left-4 z-30 bg-white/95 p-2.5 rounded-lg shadow-lg border border-gray-200 hover:bg-blue-50 pointer-events-auto"
      title="Legend"
    >
      <Info className="h-5 w-5 text-gray-700" />
    </button>
  );
});

const CoordinatesUI = React.memo(function CoordinatesUI(props: {
  show: boolean;
  onToggle: () => void;
  lat: number;
  lng: number;
}) {
  const { show, onToggle, lat, lng } = props;
  return show ? (
    <div className="absolute bottom-4 right-4 z-30 bg-white/95 rounded-lg shadow-lg border border-gray-200 p-3 pointer-events-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-red-500" />
          <div className="text-xs font-bold">Coordinates</div>
        </div>
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-700">
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="text-xs font-mono">
        <div>Lat: {lat.toFixed(6)}</div>
        <div>Lng: {lng.toFixed(6)}</div>
      </div>
    </div>
  ) : (
    <button
      onClick={onToggle}
      className="absolute bottom-4 right-4 z-30 bg-white/95 p-2.5 rounded-lg shadow-lg border border-gray-200 hover:bg-blue-50 pointer-events-auto"
      title="Coordinates"
    >
      <Navigation className="h-5 w-5 text-gray-700" />
    </button>
  );
});

const LevelBadgeUI = React.memo(function LevelBadgeUI(props: { level: string; colorClass: string; Icon: any; hidden: boolean }) {
  const { level, colorClass, Icon, hidden } = props;
  if (hidden) return null;
  return (
    <div className="absolute top-4 left-4 z-30 bg-white/95 px-4 py-2 rounded-lg shadow-lg border border-gray-200 flex items-center gap-2 pointer-events-none">
      <Icon className={`h-5 w-5 ${colorClass}`} />
      <div>
        <div className="text-[11px] text-gray-500">Viewing</div>
        <div className="text-sm font-bold">{level}</div>
      </div>
    </div>
  );
});

const PinValidationBadgeUI = React.memo(function PinValidationBadgeUI(props: { 
  isPinInsideShape: boolean | null; 
  hidden: boolean;
}) {
  const { isPinInsideShape, hidden } = props;
  if (hidden || isPinInsideShape === null) return null;
  
  return (
    <div className={`absolute top-16 left-4 z-30 px-3 py-2 rounded-lg shadow-lg border flex items-center gap-2 pointer-events-none ${
      isPinInsideShape 
        ? 'bg-green-50 border-green-400' 
        : 'bg-red-50 border-red-400 animate-pulse'
    }`}>
      {isPinInsideShape ? (
        <>
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs font-semibold text-green-800">Pin inside shape ✓</span>
        </>
      ) : (
        <>
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-xs font-semibold text-red-800">⚠️ Pin outside shape</span>
        </>
      )}
    </div>
  );
});

const DrawingToolsUI = React.memo(function DrawingToolsUI(props: {
  show: boolean;
  drawingMode: ShapeType;
  setDrawingMode: (m: ShapeType) => void;
  canUndo: boolean;
  onUndo: () => void;
  shapeCount: number;
  shapes: { id: string; type: "polygon" | "rectangle" | "circle" }[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}) {
  const { show, drawingMode, setDrawingMode, canUndo, onUndo, shapeCount, shapes, onRemove, onClearAll } = props;
  if (!show) return null;

  const ToolBtn = ({ active, onClick, children }: any) => (
    <button
      onClick={onClick}
      className={`px-2 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 ${
        active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="absolute top-4 left-4 z-30 pointer-events-auto">
      <div className="bg-white/95 rounded-xl shadow-xl border border-gray-200 overflow-hidden w-[270px]">
        <div className="p-3 border-b flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-gray-700" />
          <div className="text-xs font-bold text-gray-900">Drawing</div>
        </div>

        <div className="p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <ToolBtn active={drawingMode === "polygon"} onClick={() => setDrawingMode(drawingMode === "polygon" ? null : "polygon")}>
              <Pentagon className="h-4 w-4" />
              Polygon
            </ToolBtn>
            <ToolBtn active={drawingMode === "rectangle"} onClick={() => setDrawingMode(drawingMode === "rectangle" ? null : "rectangle")}>
              <Square className="h-4 w-4" />
              Rect
            </ToolBtn>
            <ToolBtn active={drawingMode === "circle"} onClick={() => setDrawingMode(drawingMode === "circle" ? null : "circle")}>
              <Circle className="h-4 w-4" />
              Circle
            </ToolBtn>
          </div>

          {canUndo && (
            <button onClick={onUndo} className="w-full px-3 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-semibold flex items-center justify-center gap-2">
              <Undo2 className="h-4 w-4" />
              Undo (Ctrl/Cmd+Z)
            </button>
          )}

          {shapeCount > 0 && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-gray-700">Shapes</div>
                <div className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{shapeCount}</div>
              </div>

              <div className="max-h-28 overflow-auto space-y-1">
                {shapes.map((s, idx) => (
                  <div key={s.id} className="flex items-center justify-between px-2 py-1 rounded border border-gray-200 bg-gray-50">
                    <div className="text-[11px] font-semibold text-gray-700 capitalize">
                      {s.type} #{idx + 1}
                    </div>
                    <button onClick={() => onRemove(s.id)} className="p-1 rounded hover:bg-red-50 text-red-600" title="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={onClearAll} className="mt-2 w-full px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold flex items-center justify-center gap-2">
                <Trash2 className="h-4 w-4" />
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/** ---------------- Main component ---------------- **/
export const MapLogic = ({
  initialCoords,
  addressCodes,
  preservePinWhenInsideSelectedBoundary = false,
  onCoordinatesChange,
  onAddressCodesChange,
  onReverseGeocode,
  enableShapeDrawing,
  onShapesChange,
  existingPolygon,
  disableBoundaryPinUpdate,
  mapId,
  overlayRootId,
  isFullscreen,
  toggleFullscreen,
  mapType = "roadmap",
  onMapTypeChange,
  onMapLoad,
  showMarker = true,
}: {
  initialCoords: { latitude: number; longitude: number };
  addressCodes: AddressData;
  preservePinWhenInsideSelectedBoundary?: boolean;
  onCoordinatesChange?: (coords: { latitude: number; longitude: number }) => void;
  onAddressCodesChange?: (address: AddressData) => void;
  onReverseGeocode?: (data: any) => void;
  enableShapeDrawing: boolean;
  onShapesChange?: (shapes: DrawnShape[]) => void;
  existingPolygon?: { type: string; coordinates: number[][][] };
  disableBoundaryPinUpdate: boolean;
  mapId?: string;
  overlayRootId: string;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  mapType?: "roadmap" | "satellite" | "hybrid" | "terrain";
  onMapTypeChange?: (type: "roadmap" | "satellite" | "hybrid" | "terrain") => void;
  onMapLoad?: (map: google.maps.Map) => void;
  showMarker?: boolean;
}) => {
  const map = useMap();

  /** ---- refs to avoid listener rebind ---- */
  const addressCodesRef = useLatestRef(addressCodes);
  const disableBoundaryPinUpdateRef = useLatestRef(disableBoundaryPinUpdate);
  const enableShapeDrawingRef = useLatestRef(enableShapeDrawing);
  const onAddressCodesChangeRef = useLatestRef(onAddressCodesChange);
  const onShapesChangeRef = useLatestRef(onShapesChange);
  const onReverseGeocodeRef = useLatestRef(onReverseGeocode);

  // --- Data hooks (React Query) ---
  const { data: provinces } = useProvinces();
  const { data: districts } = useDistrictsByProvinceCode(addressCodes.provinceId);
  const { data: communes } = useCommunesByDistrictCode(addressCodes.districtId);
  const { data: villages } = useVillagesByCommuneCode(addressCodes.communeId);

  const [currentCoords, setCurrentCoords] = useState(initialCoords);
  const [isInStreetView, setIsInStreetView] = useState(false);

  const [showLegend, setShowLegend] = useState(false);
  const [showCoordinates, setShowCoordinates] = useState(false);

  // ✅ Sync currentCoords when initialCoords prop changes from parent
  useEffect(() => {
    if (isInternalUpdate.current) return;

    const latChanged = Math.abs(initialCoords.latitude - currentCoords.latitude) > 0.000001;
    const lngChanged = Math.abs(initialCoords.longitude - currentCoords.longitude) > 0.000001;

    if (!latChanged && !lngChanged) return;

    // External address/coordinate updates should always move the marker.
    userManuallyPlacedPin.current = false;
    setCurrentCoords(initialCoords);

    if (map) {
      map.panTo({ lat: initialCoords.latitude, lng: initialCoords.longitude });

      const hasSelectedAddress =
        Boolean(addressCodes.provinceId) ||
        Boolean(addressCodes.districtId) ||
        Boolean(addressCodes.communeId) ||
        Boolean(addressCodes.villageId);
      const isDefaultPin =
        Math.abs(initialCoords.latitude - DEFAULT_PIN_LATITUDE) <= 0.000001 &&
        Math.abs(initialCoords.longitude - DEFAULT_PIN_LONGITUDE) <= 0.000001;

      if (!hasSelectedAddress && !isDefaultPin && (map.getZoom() ?? 0) < 16) {
        map.setZoom(16);
      }

      if (legacyMarkerRef.current) {
        legacyMarkerRef.current.setPosition({
          lat: initialCoords.latitude,
          lng: initialCoords.longitude
        });
      }
    }
  }, [
    addressCodes.communeId,
    addressCodes.districtId,
    addressCodes.provinceId,
    addressCodes.villageId,
    currentCoords.latitude,
    currentCoords.longitude,
    initialCoords.latitude,
    initialCoords.longitude,
    map,
  ]);

  // Map type: controlled or local
  const [localMapType, setLocalMapType] = useState<"roadmap" | "satellite" | "hybrid" | "terrain">("roadmap");
  const currentMapType = mapType || localMapType;
  const handleMapTypeChange = (t: "roadmap" | "satellite" | "hybrid" | "terrain") => {
    if (onMapTypeChange) onMapTypeChange(t);
    else setLocalMapType(t);
  };

  const [showStreetViewLayer, setShowStreetViewLayer] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Search
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const canUsePlacesSearch =
    typeof window !== "undefined" && !!window.google?.maps?.places;

  // Street view
  const streetViewLayerRef = useRef<google.maps.StreetViewCoverageLayer | null>(null);
  const streetViewServiceRef = useRef<google.maps.StreetViewService | null>(null);

  // Marker fallback (if no mapId)
  const legacyMarkerRef = useRef<google.maps.Marker | null>(null);

  // Portal target
  const [overlayEl, setOverlayEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setOverlayEl(document.getElementById(overlayRootId));
  }, [overlayRootId]);

  const showNotification = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  // reverse geocode hook control
  const ignoreReverseGeocode = useRef(false);
  const shouldFetchReverseGeocode = useMemo(() => {
    return (
      !!onReverseGeocode &&
      !!currentCoords.latitude &&
      !!currentCoords.longitude &&
      !ignoreReverseGeocode.current
    );
  }, [currentCoords.latitude, currentCoords.longitude, onReverseGeocode]);

  const { data: reverseGeocodeData } = useReverseGeocode(
    currentCoords.latitude,
    currentCoords.longitude,
    shouldFetchReverseGeocode
  );

  // drawing
  const [drawingMode, setDrawingMode] = useState<ShapeType>(null);
  const drawingModeRef = useLatestRef(drawingMode);

  const overlaysRef = useRef<Map<string, google.maps.MVCObject>>(new Map());
  const [shapeMetas, setShapeMetas] = useState<{ id: string; type: "polygon" | "rectangle" | "circle" }[]>([]);
  const shapeMetasRef = useLatestRef(shapeMetas);
  const [shapeHistory, setShapeHistory] = useState<SerializedShape[][]>([]);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const [isPinInsideShape, setIsPinInsideShape] = useState<boolean | null>(null);

  const userManuallyPlacedPin = useRef(false);
  const isInternalUpdate = useRef(false);

  const markerPos = useMemo(
    () => ({ lat: currentCoords.latitude, lng: currentCoords.longitude }),
    [currentCoords.latitude, currentCoords.longitude]
  );

  const handleManualLocationUpdate = useCallback(
    (lat: number, lng: number, isUserAction = false, notifyParent = true) => {
      if (isUserAction) userManuallyPlacedPin.current = true;
      setCurrentCoords({ latitude: lat, longitude: lng });
      if (notifyParent) {
        onCoordinatesChange?.({ latitude: lat, longitude: lng });
      }
      
      // ✅ Check if new position is inside shapes
      if (shapeMetas.length > 0 && enableShapeDrawing) {
        const isInside = checkPinInsideShapes(lat, lng);
        setIsPinInsideShape(isInside);
        
        if (isInside === false && isUserAction) {
          showNotification('⚠️ Pin is outside drawn shapes', 'error');
        }
      }
    },
    [onCoordinatesChange, shapeMetas.length, enableShapeDrawing, showNotification]
  );
  const handleManualLocationUpdateRef = useLatestRef(handleManualLocationUpdate);

  // onMapLoad
  useEffect(() => {
    if (map && onMapLoad) onMapLoad(map);
  }, [map, onMapLoad]);

  /** ---------------- Map setup ---------------- **/
  useEffect(() => {
    if (!map) return;

    map.setMapTypeId(currentMapType);
    map.setOptions({
      streetViewControl: true,
      streetViewControlOptions: { position: window.google?.maps?.ControlPosition?.LEFT_TOP },
      mapTypeControl: false,
      zoomControl: false,
      fullscreenControl: false,
      draggableCursor: drawingModeRef.current ? "crosshair" : "default",
      styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }],
    });

    const sv = map.getStreetView();
    const visibleListener = sv.addListener("visible_changed", () => {
      const visible = sv.getVisible();
      setIsInStreetView(visible);

      if (visible && !showStreetViewLayer) {
        const layer = new google.maps.StreetViewCoverageLayer();
        layer.setMap(map);
        streetViewLayerRef.current = layer;
      } else if (!visible && streetViewLayerRef.current && !showStreetViewLayer) {
        streetViewLayerRef.current.setMap(null);
        streetViewLayerRef.current = null;
      }
    });

    const svPosListener = sv.addListener("position_changed", () => {
      const pos = sv.getPosition();
      if (!pos) return;
      handleManualLocationUpdateRef.current(pos.lat(), pos.lng(), true);
      legacyMarkerRef.current?.setPosition(pos);
    });

    return () => {
      google.maps.event.removeListener(visibleListener);
      google.maps.event.removeListener(svPosListener);
    };
  }, [map, currentMapType, showStreetViewLayer, drawingModeRef, handleManualLocationUpdateRef]);

  /** ---------------- Global GIS style (zIndex fix) ---------------- **/
  useEffect(() => {
    if (!map) return;

    map.data.setStyle((feature) => {
      const layerType = feature.getProperty("layerType") as GisLayerType | undefined;
      const isSat = isSatelliteLike(map);
      const base = layerType ? GIS_PALETTE[layerType] : { fill: "#3b82f6", stroke: "#1d4ed8" };

      const fillOpacity = layerType === "province" ? (isSat ? 0.1 : 0.14) : isSat ? 0.14 : 0.26;

      return {
        fillColor: base.fill,
        fillOpacity,
        strokeColor: base.stroke,
        strokeOpacity: isSat ? 0.98 : 0.85,
        strokeWeight: isSat ? 4 : 3,
        clickable: !(enableShapeDrawingRef.current && drawingModeRef.current),
        zIndex: layerType ? (LAYER_Z[layerType] ?? 10) : 10, // ✅ commune/village above province
      };
    });

    const idListener = map.addListener("maptypeid_changed", () => {
      map.data.revertStyle();
    });

    return () => google.maps.event.removeListener(idListener);
  }, [map, enableShapeDrawingRef, drawingModeRef]);

  /** ---------------- Marker fallback (no mapId) ---------------- **/
  useEffect(() => {
    if (!map) return;
    if (mapId) return;
    if (!window.google?.maps) return;

    if (!legacyMarkerRef.current) {
      legacyMarkerRef.current = new google.maps.Marker({
        map,
        position: markerPos,
        draggable: true,
        animation: google.maps.Animation.DROP,
      });

      legacyMarkerRef.current.addListener("dragend", () => {
        const pos = legacyMarkerRef.current?.getPosition();
        if (!pos) return;
        ignoreReverseGeocode.current = false;
        handleManualLocationUpdateRef.current(pos.lat(), pos.lng(), true);
      });
    } else {
      legacyMarkerRef.current.setPosition(markerPos);
    }
  }, [map, mapId, markerPos, handleManualLocationUpdateRef]);

  useEffect(() => {
    return () => {
      legacyMarkerRef.current?.setMap(null);
      legacyMarkerRef.current = null;
    };
  }, []);

  /** ---------------- GIS layer rendering (with parent ids) ---------------- **/
  const layerSigRef = useRef<Record<string, string>>({});
  const getLayerSig = useCallback((rows: any[] | undefined) => {
    if (!rows?.length) return "";
    const first = rows[0]?.code ?? "";
    const last = rows[rows.length - 1]?.code ?? "";
    return `${rows.length}|${first}|${last}`;
  }, []);

  const countLayerFeatures = (map: google.maps.Map, type: GisLayerType) => {
  let n = 0;
  map.data.forEach((f) => {
    if (f.getProperty("layerType") === type) n++;
  });
  return n;
};

const renderLayer = useCallback(
  (
    data: any[] | undefined,
    type: GisLayerType,
    ctx?: { provinceId?: string | null; districtId?: string | null; communeId?: string | null },
    opts?: { onlyCode?: string | null }
  ) => {
    if (!map) return;

    const rows = opts?.onlyCode ? (data || []).filter((x) => x.code === opts.onlyCode) : data;
    if (!rows?.length) return;

    const sig = getLayerSig(rows);

    // ✅ IMPORTANT: if map has 0 features for this type, force rebuild even if sig matches
    const existing = countLayerFeatures(map, type);
    if (layerSigRef.current[type] === sig && existing > 0) return;

    layerSigRef.current[type] = sig;

    // remove old of same type
    const rm: google.maps.Data.Feature[] = [];
    map.data.forEach((f) => {
      if (f.getProperty("layerType") === type) rm.push(f);
    });
    rm.forEach((f) => map.data.remove(f));

    const features: GeoJSON.Feature[] = [];
    for (const item of rows) {
      const parsed = safeParseBoundary(item.boundary ?? item.geom ?? item.geometry);
      if (!parsed) continue;

      const geom = normalizeGeoJsonCoords(parsed);
      if (!geom?.type || !geom?.coordinates) continue;

      const provinceId = item.provinceId ?? ctx?.provinceId ?? null;
      const districtId = item.districtId ?? ctx?.districtId ?? null;
      const communeId = item.communeId ?? ctx?.communeId ?? null;

      features.push({
        type: "Feature",
        geometry: geom,
        properties: {
          layerType: type,
          type,
          code: item.code,
          nameEn: item.nameEn,
          nameKh: item.nameKh,
          provinceId,
          districtId,
          communeId,
        },
      } as any);
    }

    if (features.length) {
      map.data.addGeoJson({ type: "FeatureCollection", features } as any);
    }
  },
  [map, getLayerSig]
);


  const zoomAndPin = useCallback(
    (boundaryData: any[] | undefined, selectedCode: string | null) => {
      if (!map || !boundaryData?.length || !selectedCode) return false;

      const selectedItem = boundaryData.find((item) => item.code === selectedCode);
      if (!selectedItem) return false;

      const parsed = safeParseBoundary(selectedItem.boundary ?? selectedItem.geom ?? selectedItem.geometry);
      if (!parsed) return false;

      const geom = normalizeGeoJsonCoords(parsed);
      const bounds = geoJsonToBounds(geom);
      if (!bounds) return false;

      const currentPos = new google.maps.LatLng(markerPos.lat, markerPos.lng);
      const isPinInside = bounds.contains(currentPos);
      if (userManuallyPlacedPin.current && isPinInside) return true;
      if (preservePinWhenInsideSelectedBoundary && isPinInside) return true;

      if (!userManuallyPlacedPin.current) map.fitBounds(bounds);

      if (!userManuallyPlacedPin.current && !disableBoundaryPinUpdateRef.current) {
        const center = bounds.getCenter();
        handleManualLocationUpdateRef.current(center.lat(), center.lng(), false, false);
        legacyMarkerRef.current?.setPosition(center);
      }

      return true;
    },
    [
      map,
      markerPos.lat,
      markerPos.lng,
      disableBoundaryPinUpdateRef,
      handleManualLocationUpdateRef,
      preservePinWhenInsideSelectedBoundary,
    ]
  );

  /**
   * ✅ Selection rendering rules:
   * - Province selected: show ONLY that province + all districts inside it
   * - District selected: show ONLY that district + all communes inside it
   * - Commune selected: show ONLY that commune + all villages inside it
   * - Village selected: show ONLY that village + its commune (context)
   */
  useEffect(() => {
    if (!map) return;

    const hasNothing =
      !addressCodes.provinceId && !addressCodes.districtId && !addressCodes.communeId && !addressCodes.villageId;

    if (hasNothing) {
      clearAllGis(map, layerSigRef);
      renderLayer(provinces || [], "province");
      return;
    }

    // province
    if (addressCodes.provinceId && !addressCodes.districtId) {
      clearGisExcept(map, ["province", "district"], layerSigRef);
      renderLayer(provinces || [], "province", undefined, { onlyCode: addressCodes.provinceId });
      renderLayer(districts || [], "district", { provinceId: addressCodes.provinceId });
      zoomAndPin(provinces || [], addressCodes.provinceId);
      return;
    }

    // district
    if (addressCodes.districtId && !addressCodes.communeId) {
      clearGisExcept(map, ["district", "commune"], layerSigRef);
      renderLayer(districts || [], "district", { provinceId: addressCodes.provinceId }, { onlyCode: addressCodes.districtId });
      renderLayer(communes || [], "commune", { provinceId: addressCodes.provinceId, districtId: addressCodes.districtId });
      zoomAndPin(districts || [], addressCodes.districtId);
      return;
    }

    // commune
    if (addressCodes.communeId && !addressCodes.villageId) {
      clearGisExcept(map, ["commune", "village"], layerSigRef);
      renderLayer(
        communes || [],
        "commune",
        { provinceId: addressCodes.provinceId, districtId: addressCodes.districtId },
        { onlyCode: addressCodes.communeId }
      );
      renderLayer(
        villages || [],
        "village",
        { provinceId: addressCodes.provinceId, districtId: addressCodes.districtId, communeId: addressCodes.communeId }
      );
      zoomAndPin(communes || [], addressCodes.communeId);
      return;
    }

    // village
    if (addressCodes.villageId) {
      const selectedVillage = (villages || []).find(
        (item) => item.code === addressCodes.villageId
      );
      const hasSelectedVillageBoundary = hasRenderableBoundary(selectedVillage);

      if (!hasSelectedVillageBoundary) {
        clearGisExcept(map, ["commune"], layerSigRef);
        renderLayer(
          communes || [],
          "commune",
          { provinceId: addressCodes.provinceId, districtId: addressCodes.districtId },
          { onlyCode: addressCodes.communeId }
        );
        zoomAndPin(communes || [], addressCodes.communeId);
        return;
      }

      clearGisExcept(map, ["village", "commune"], layerSigRef);
      renderLayer(
        communes || [],
        "commune",
        { provinceId: addressCodes.provinceId, districtId: addressCodes.districtId },
        { onlyCode: addressCodes.communeId }
      );
      renderLayer(
        villages || [],
        "village",
        { communeId: addressCodes.communeId },
        { onlyCode: addressCodes.villageId }
      );
      const zoomedVillage = zoomAndPin(villages || [], addressCodes.villageId);
      if (!zoomedVillage) {
        zoomAndPin(communes || [], addressCodes.communeId);
      }
      return;
    }

    if (isInternalUpdate.current) isInternalUpdate.current = false;
  }, [map, addressCodes, provinces, districts, communes, villages, renderLayer, zoomAndPin]);

  /** ---------------- ✅ Click handling (fix commune click + click stealing) ---------------- **/
  const justClickedDataRef = useRef(false);

  useEffect(() => {
    if (!map) return;

    const tooltip = new google.maps.InfoWindow({
      disableAutoPan: true,
      content: "",
      pixelOffset: new google.maps.Size(0, -15),
      zIndex: 9999,
    });

    const getTypeIcon = (type: string) => {
      switch (type) {
        case "province":
          return "🏛️";
        case "district":
          return "🏢";
        case "commune":
          return "🏘️";
        case "village":
          return "🏡";
        default:
          return "📍";
      }
    };

    let raf = 0;
    let lastLatLng: google.maps.LatLng | null = null;

    const mouseOver = map.data.addListener("mouseover", (event: google.maps.Data.MouseEvent) => {
      if (enableShapeDrawingRef.current && drawingModeRef.current) return;

      const isSat = isSatelliteLike(map);

      map.data.overrideStyle(event.feature, {
        fillOpacity: isSat ? 0.22 : 0.35,
        strokeOpacity: 1,
        strokeWeight: isSat ? 7 : 6,
        strokeColor: "#0ea5e9",
        zIndex: 9999,
        cursor: "pointer",
      });

      const nameKh = event.feature.getProperty("nameKh");
      const nameEn = event.feature.getProperty("nameEn");
      const code = event.feature.getProperty("code");
      const type = event.feature.getProperty("type") as string;

      tooltip.setContent(`
        <div style="
          padding:10px 14px;
          font-family: Inter, Hanuman, sans-serif;
          background:#ffffff;
          border-radius:10px;
          box-shadow:0 10px 15px -3px rgba(0,0,0,.12), 0 4px 6px -2px rgba(0,0,0,.08);
          border:1px solid #e2e8f0;
          text-align:center;
          min-width:140px;
          max-width:260px;
        ">
          <div style="font-size:20px;margin-bottom:6px;">${getTypeIcon(type)}</div>
          <div style="font-size:15px;font-weight:800;color:#0f172a;line-height:1.3;margin-bottom:2px;">
            ${nameKh || nameEn || "Unknown"}
          </div>
          ${
            nameKh && nameEn && nameKh !== nameEn
              ? `<div style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:6px;">${nameEn}</div>`
              : ""
          }
          <div style="
            margin-top:8px;
            padding-top:6px;
            border-top:1px solid #e2e8f0;
            font-size:10px;
            color:#94a3b8;
            font-family:monospace;
            text-transform:uppercase;
            letter-spacing:.5px;
          ">
            ${type} • ${code || ""}
          </div>
        </div>
      `);

      tooltip.setPosition(event.latLng);
      tooltip.open(map);
    });

    const mouseMove = map.data.addListener("mousemove", (event: google.maps.Data.MouseEvent) => {
      lastLatLng = event.latLng;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (lastLatLng) tooltip.setPosition(lastLatLng);
      });
    });

    const mouseOut = map.data.addListener("mouseout", () => {
      map.data.revertStyle();
      tooltip.close();
    });

    // ✅ Click on GIS feature (province/district/commune/village)
    const dataClick = map.data.addListener("click", (event: google.maps.Data.MouseEvent) => {
      if (enableShapeDrawingRef.current && drawingModeRef.current) return;

      justClickedDataRef.current = true;
      setTimeout(() => (justClickedDataRef.current = false), 0);

      const type = event.feature.getProperty("type") as GisLayerType;
      const code = event.feature.getProperty("code") as string;

      // parent ids (filled by renderLayer)
      const provinceId = (event.feature.getProperty("provinceId") as string) ?? null;
      const districtId = (event.feature.getProperty("districtId") as string) ?? null;
      const communeId = (event.feature.getProperty("communeId") as string) ?? null;

      isInternalUpdate.current = true;
      ignoreReverseGeocode.current = true;

      if (!disableBoundaryPinUpdateRef.current) userManuallyPlacedPin.current = false;

      const onChange = onAddressCodesChangeRef.current;
      if (onChange) {
        const cur = addressCodesRef.current;
        const next = { ...cur };

        // ✅ based on your schema
        if (type === "province") {
          next.provinceId = code;
          next.districtId = null;
          next.communeId = null;
          next.villageId = null;
        } else if (type === "district") {
          next.provinceId = provinceId ?? cur.provinceId ?? null;
          next.districtId = code;
          next.communeId = null;
          next.villageId = null;
        } else if (type === "commune") {
          next.provinceId = cur.provinceId ?? null;
          next.districtId = districtId ?? cur.districtId ?? null;
          next.communeId = code;
          next.villageId = null;
        } else if (type === "village") {
          next.provinceId = cur.provinceId ?? null;
          next.districtId = cur.districtId ?? null;
          next.communeId = communeId ?? cur.communeId ?? null;
          next.villageId = code;
        }

        onChange(next);
      }

      // Fit bounds to clicked feature
      const geo = event.feature.getGeometry();
      if (geo) {
        const bounds = new google.maps.LatLngBounds();
        const processPoints = (geometry: any, callback: any, thisArg: any) => {
          if (geometry instanceof google.maps.Data.Point) callback.call(thisArg, geometry.get());
          else if (geometry instanceof google.maps.Data.Polygon) {
            geometry.getArray().forEach((path: any) =>
              path.getArray().forEach((latLng: any) => callback.call(thisArg, latLng))
            );
          } else if (geometry instanceof google.maps.Data.MultiPolygon) {
            geometry.getArray().forEach((polygon: any) => processPoints(polygon, callback, thisArg));
          }
        };

        processPoints(geo, bounds.extend, bounds);
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds);

          if (!disableBoundaryPinUpdateRef.current) {
            const center = bounds.getCenter();
            handleManualLocationUpdateRef.current(center.lat(), center.lng(), false, false);
            legacyMarkerRef.current?.setPosition(center);
          }
        }
      }
    });

    // ✅ Fallback click (empty areas) – only runs when NOT clicking a feature
    const geocodingTimeoutRef = { current: null as NodeJS.Timeout | null };

    const mapClick = map.addListener("click", async (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return;
      if (enableShapeDrawingRef.current && drawingModeRef.current) return;
      if (justClickedDataRef.current) return; // ✅ prevents stealing click after dataClick

      const lat = event.latLng.lat();
      const lng = event.latLng.lng();

      handleManualLocationUpdateRef.current(lat, lng, true);
      legacyMarkerRef.current?.setPosition(event.latLng);

      if (geocodingTimeoutRef.current) clearTimeout(geocodingTimeoutRef.current);

      geocodingTimeoutRef.current = setTimeout(async () => {
        if (!onReverseGeocodeRef.current) return;
        try {
          showNotification("Detecting location…", "info");

          const geocoder = new google.maps.Geocoder();
          const response = await geocoder.geocode({ location: event.latLng });

          if (response.results?.length) {
            const result = response.results[0];
            onReverseGeocodeRef.current?.(result);
            showNotification("Location detected ✓", "success");
          } else {
            showNotification("No address found", "info");
          }
        } catch (err) {
          console.error(err);
          showNotification("Reverse geocoding failed", "error");
        }
      }, 250);
    });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (geocodingTimeoutRef.current) clearTimeout(geocodingTimeoutRef.current);
      google.maps.event.removeListener(mouseOver);
      google.maps.event.removeListener(mouseMove);
      google.maps.event.removeListener(mouseOut);
      google.maps.event.removeListener(dataClick);
      google.maps.event.removeListener(mapClick);
      tooltip.close();
    };
  }, [
    map,
    addressCodesRef,
    onAddressCodesChangeRef,
    enableShapeDrawingRef,
    drawingModeRef,
    disableBoundaryPinUpdateRef,
    handleManualLocationUpdateRef,
    onReverseGeocodeRef,
    showNotification,
  ]);

  /** ---------------- StreetView / Pegman ---------------- **/
  const openStreetViewAt = useCallback(
    (lat: number, lng: number, noticeDistance = true) => {
      if (!map || !window.google?.maps) return;
      const sv = map.getStreetView();

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        showNotification("Street View location is not valid.", "error");
        return;
      }

      if (!streetViewServiceRef.current) streetViewServiceRef.current = new google.maps.StreetViewService();

      streetViewServiceRef.current.getPanorama({ location: { lat, lng }, radius: 150 }, (data, status) => {
        if (status !== google.maps.StreetViewStatus.OK || !data?.location?.latLng) {
          showNotification("Street View is not available here.", "info");
          return;
        }

        const panoLatLng = data.location.latLng;
        const heading = google.maps.geometry?.spherical?.computeHeading?.(panoLatLng, new google.maps.LatLng(lat, lng));
        if (data.location.pano) sv.setPano(data.location.pano);
        sv.setPosition(panoLatLng);
        if (typeof heading === "number") sv.setPov({ heading, pitch: 0 });
        sv.setVisible(true);

        if (noticeDistance) {
          const distance =
            google.maps.geometry?.spherical?.computeDistanceBetween?.(panoLatLng, new google.maps.LatLng(lat, lng)) ?? null;
          if (typeof distance === "number" && distance > 60) showNotification("Nearest Street View is away from the pin.", "info");
        }
      });
    },
    [map, showNotification]
  );

  const togglePegmanAtPin = useCallback(() => {
    if (!map) return;
    const sv = map.getStreetView();
    const visible = sv.getVisible();
    if (visible) return sv.setVisible(false);
    openStreetViewAt(markerPos.lat, markerPos.lng);
  }, [map, markerPos.lat, markerPos.lng, openStreetViewAt]);

  const toggleStreetViewLayer = useCallback(() => {
    if (!map) return;
    if (!showStreetViewLayer) {
      const layer = new google.maps.StreetViewCoverageLayer();
      layer.setMap(map);
      streetViewLayerRef.current = layer;
      setShowStreetViewLayer(true);
    } else {
      streetViewLayerRef.current?.setMap(null);
      streetViewLayerRef.current = null;
      setShowStreetViewLayer(false);
    }
  }, [map, showStreetViewLayer]);

  /** ---------------- DrawingManager (works if you load "drawing" library) ---------------- **/
  const shapeIdCounterRef = useRef(0);
  const getNextShapeId = useCallback((prefix: string) => {
    shapeIdCounterRef.current += 1;
    return `${prefix}-${Date.now()}-${shapeIdCounterRef.current}`;
  }, []);

  const removeOverlay = useCallback((overlay: any) => {
    try {
      const ls: google.maps.MapsEventListener[] = overlay?.__listeners || [];
      ls.forEach((l) => google.maps.event.removeListener(l));
    } catch {}
    overlay?.setMap?.(null);
  }, []);

  const emitShapesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ Check if a point is inside any of the drawn shapes
  const checkPinInsideShapes = useCallback((lat: number, lng: number) => {
    if (!window.google?.maps?.geometry) return null;
    if (shapeMetas.length === 0) return null;

    const point = new google.maps.LatLng(lat, lng);
    
    for (const meta of shapeMetas) {
      const overlay = overlaysRef.current.get(meta.id);
      if (!overlay) continue;

      if (meta.type === 'polygon') {
        const poly = overlay as google.maps.Polygon;
        if (google.maps.geometry.poly.containsLocation(point, poly)) {
          return true;
        }
      } else if (meta.type === 'rectangle') {
        const rect = overlay as google.maps.Rectangle;
        const bounds = rect.getBounds();
        if (bounds?.contains(point)) {
          return true;
        }
      } else if (meta.type === 'circle') {
        const circle = overlay as google.maps.Circle;
        const center = circle.getCenter();
        const radius = circle.getRadius();
        if (center) {
          const distance = google.maps.geometry.spherical.computeDistanceBetween(point, center);
          if (distance <= radius) {
            return true;
          }
        }
      }
    }
    
    return false;
  }, [shapeMetas]);

  const emitShapes = useCallback(() => {
    if (emitShapesTimeoutRef.current) clearTimeout(emitShapesTimeoutRef.current);

    emitShapesTimeoutRef.current = setTimeout(() => {
      const metas = shapeMetasRef.current;
      const shapes: DrawnShape[] = metas
        .map((m) => {
          const overlay = overlaysRef.current.get(m.id);
          if (!overlay) return null;
          return { id: m.id, type: m.type, shape: overlay } as any;
        })
        .filter(Boolean) as any;

      onShapesChangeRef.current?.(shapes);
      
      // ✅ Check if pin is inside shapes after emit
      if (shapes.length > 0) {
        const isInside = checkPinInsideShapes(currentCoords.latitude, currentCoords.longitude);
        setIsPinInsideShape(isInside);
      } else {
        setIsPinInsideShape(null);
      }
    }, 100);
  }, [shapeMetasRef, onShapesChangeRef, checkPinInsideShapes, currentCoords.latitude, currentCoords.longitude]);

  useEffect(() => {
    return () => {
      if (emitShapesTimeoutRef.current) clearTimeout(emitShapesTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (shapeMetas.length > 0 || overlaysRef.current.size > 0) emitShapes();
  }, [shapeMetas, emitShapes]);

  const serializeCurrentShapes = useCallback((): SerializedShape[] => {
    return shapeMetasRef.current
      .map((m) => {
        const overlay = overlaysRef.current.get(m.id);
        if (!overlay) return null;

        if (m.type === "polygon") {
          const poly = overlay as google.maps.Polygon;
          return { id: m.id, type: "polygon", ring: polygonPathToRing(poly) } as const;
        }
        if (m.type === "rectangle") {
          const rect = overlay as google.maps.Rectangle;
          return { id: m.id, type: "rectangle", ring: rectangleToRing(rect) } as const;
        }
        const c = overlay as google.maps.Circle;
        const center = c.getCenter();
        return center
          ? ({ id: m.id, type: "circle", center: { lat: center.lat(), lng: center.lng() }, radius: c.getRadius() } as const)
          : null;
      })
      .filter(Boolean) as SerializedShape[];
  }, [shapeMetasRef]);

  const restoreFromSerialized = useCallback(
    (snap: SerializedShape[]) => {
      if (!map) return;

      overlaysRef.current.forEach((ov) => removeOverlay(ov));
      overlaysRef.current.clear();

      const nextMetas: { id: string; type: "polygon" | "rectangle" | "circle" }[] = [];
      for (const s of snap) {
        if (s.type === "polygon") {
          const poly = new google.maps.Polygon({
            paths: s.ring,
            map,
            fillColor: "#3b82f6",
            fillOpacity: 0.35,
            strokeColor: "#2563eb",
            strokeWeight: 2,
            editable: true,
            draggable: true,
          });
          overlaysRef.current.set(s.id, poly);
          nextMetas.push({ id: s.id, type: "polygon" });
        } else if (s.type === "rectangle") {
          const ring = s.ring;
          if (ring.length >= 4) {
            const lats = ring.map((p) => p.lat);
            const lngs = ring.map((p) => p.lng);
            const b = new google.maps.LatLngBounds(
              { lat: Math.min(...lats), lng: Math.min(...lngs) },
              { lat: Math.max(...lats), lng: Math.max(...lngs) }
            );
            const rect = new google.maps.Rectangle({
              map,
              bounds: b,
              fillColor: "#10b981",
              fillOpacity: 0.35,
              strokeColor: "#059669",
              strokeWeight: 2,
              editable: true,
              draggable: true,
            });
            overlaysRef.current.set(s.id, rect);
            nextMetas.push({ id: s.id, type: "rectangle" });
          }
        } else if (s.type === "circle") {
          const c = new google.maps.Circle({
            map,
            center: s.center,
            radius: s.radius,
            fillColor: "#f59e0b",
            fillOpacity: 0.35,
            strokeColor: "#d97706",
            strokeWeight: 2,
            editable: true,
            draggable: true,
          });
          overlaysRef.current.set(s.id, c);
          nextMetas.push({ id: s.id, type: "circle" });
        }
      }

      setShapeMetas(nextMetas);
      emitShapes();
    },
    [map, removeOverlay, emitShapes]
  );

  const setGMOverlayEditableAndTrack = useCallback(
    (overlay: google.maps.MVCObject, type: "polygon" | "rectangle" | "circle") => {
      (overlay as any).setEditable?.(true);
      (overlay as any).setDraggable?.(true);

      const listeners: google.maps.MapsEventListener[] = [];

      if (type === "polygon") {
        const poly = overlay as google.maps.Polygon;
        const path = poly.getPath();
        listeners.push(
          google.maps.event.addListener(path, "insert_at", emitShapes),
          google.maps.event.addListener(path, "set_at", emitShapes),
          google.maps.event.addListener(path, "remove_at", emitShapes),
          google.maps.event.addListener(poly, "dragend", emitShapes)
        );
      }

      if (type === "rectangle") {
        const rect = overlay as google.maps.Rectangle;
        listeners.push(
          google.maps.event.addListener(rect, "bounds_changed", emitShapes),
          google.maps.event.addListener(rect, "dragend", emitShapes)
        );
      }

      if (type === "circle") {
        const c = overlay as google.maps.Circle;
        listeners.push(
          google.maps.event.addListener(c, "center_changed", emitShapes),
          google.maps.event.addListener(c, "radius_changed", emitShapes),
          google.maps.event.addListener(c, "dragend", emitShapes)
        );
      }

      (overlay as any).__listeners = listeners;
    },
    [emitShapes]
  );

  useEffect(() => {
    if (!map) return;

    if (!enableShapeDrawing) {
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setMap(null);
        drawingManagerRef.current = null;
      }
      return;
    }

    if (!window.google?.maps?.drawing) {
      console.error("Google Maps Drawing library not loaded. Add 'drawing' to APIProvider libraries.");
      return;
    }

    if (!drawingManagerRef.current) {
      const dm = new google.maps.drawing.DrawingManager({
        drawingControl: false,
        drawingMode: null,
        polygonOptions: { fillColor: "#3b82f6", fillOpacity: 0.35, strokeColor: "#2563eb", strokeWeight: 2, editable: true, draggable: true },
        rectangleOptions: { fillColor: "#10b981", fillOpacity: 0.35, strokeColor: "#059669", strokeWeight: 2, editable: true, draggable: true },
        circleOptions: { fillColor: "#f59e0b", fillOpacity: 0.35, strokeColor: "#d97706", strokeWeight: 2, editable: true, draggable: true },
      });

      dm.setMap(map);
      drawingManagerRef.current = dm;

      const pushHistory = () => setShapeHistory((h) => [...h, serializeCurrentShapes()]);

      const onComplete = (type: "polygon" | "rectangle" | "circle") => (overlay: any) => {
        pushHistory();

        const id = getNextShapeId(type);
        overlaysRef.current.set(id, overlay);
        setShapeMetas((prev) => [...prev, { id, type }]);

        setDrawingMode(null);
        dm.setDrawingMode(null);

        setGMOverlayEditableAndTrack(overlay, type);

        // Auto-center pin to the newly drawn shape center.
        let center: google.maps.LatLng | null = null;
        if (type === "polygon") {
          const path = (overlay as google.maps.Polygon).getPath?.();
          if (path?.getLength()) {
            const bounds = new google.maps.LatLngBounds();
            for (let i = 0; i < path.getLength(); i += 1) {
              bounds.extend(path.getAt(i));
            }
            center = bounds.getCenter();
          }
        } else if (type === "rectangle") {
          center = (overlay as google.maps.Rectangle).getBounds?.()?.getCenter() ?? null;
        } else if (type === "circle") {
          center = (overlay as google.maps.Circle).getCenter?.() ?? null;
        }

        if (center) {
          userManuallyPlacedPin.current = false;
          handleManualLocationUpdateRef.current(center.lat(), center.lng(), false);
          legacyMarkerRef.current?.setPosition(center);
        }

        emitShapes();
        showNotification(`${type} added ✓`, "success");
      };

      const polyListener = google.maps.event.addListener(dm, "polygoncomplete", (poly: google.maps.Polygon) => onComplete("polygon")(poly));
      const rectListener = google.maps.event.addListener(dm, "rectanglecomplete", (rect: google.maps.Rectangle) => onComplete("rectangle")(rect));
      const circleListener = google.maps.event.addListener(dm, "circlecomplete", (circle: google.maps.Circle) => onComplete("circle")(circle));

      (dm as any).__listeners = [polyListener, rectListener, circleListener];
    }
  }, [map, enableShapeDrawing, getNextShapeId, setGMOverlayEditableAndTrack, emitShapes, showNotification, serializeCurrentShapes]);

  useEffect(() => {
    const dm = drawingManagerRef.current;
    if (!dm || !enableShapeDrawing) return;

    if (!drawingMode) return dm.setDrawingMode(null);
    if (drawingMode === "polygon") dm.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    if (drawingMode === "rectangle") dm.setDrawingMode(google.maps.drawing.OverlayType.RECTANGLE);
    if (drawingMode === "circle") dm.setDrawingMode(google.maps.drawing.OverlayType.CIRCLE);
  }, [drawingMode, enableShapeDrawing]);

  const undoLastAction = useCallback(() => {
    setShapeHistory((history) => {
      if (!history.length) {
        showNotification("Nothing to undo", "info");
        return history;
      }
      const snap = history[history.length - 1];
      const nextHistory = history.slice(0, -1);
      restoreFromSerialized(snap);
      showNotification("Undo ✓", "success");
      return nextHistory;
    });
  }, [restoreFromSerialized, showNotification]);

  const clearAllShapes = useCallback(() => {
    setShapeHistory((h) => [...h, serializeCurrentShapes()]);
    overlaysRef.current.forEach((ov) => removeOverlay(ov));
    overlaysRef.current.clear();
    setShapeMetas([]);
    emitShapes();
    setDrawingMode(null);
    showNotification("Cleared shapes", "info");
  }, [removeOverlay, emitShapes, showNotification, serializeCurrentShapes]);

  const removeShape = useCallback(
    (id: string) => {
      setShapeHistory((h) => [...h, serializeCurrentShapes()]);
      const overlay = overlaysRef.current.get(id);
      if (overlay) removeOverlay(overlay);
      overlaysRef.current.delete(id);

      setShapeMetas((prev) => prev.filter((s) => s.id !== id));
      emitShapes();
      showNotification("Shape removed", "info");
    },
    [removeOverlay, emitShapes, showNotification, serializeCurrentShapes]
  );

  /** Keyboard shortcuts **/
  useEffect(() => {
    if (!enableShapeDrawing) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoLastAction();
      }
      if (e.key === "Escape") {
        setDrawingMode(null);
        drawingManagerRef.current?.setDrawingMode(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enableShapeDrawing, undoLastAction]);

  /** Existing polygon render (readonly overlay) **/
  useEffect(() => {
    if (!map || !existingPolygon) return;

    try {
      if (existingPolygon.type === "Polygon" && existingPolygon.coordinates?.[0]) {
        const paths = existingPolygon.coordinates[0].map((coord) => ({ lat: coord[1], lng: coord[0] }));

        const poly = new google.maps.Polygon({
          paths,
          map,
          fillColor: enableShapeDrawing ? "#10b981" : "#3b82f6",
          fillOpacity: enableShapeDrawing ? 0.2 : 0.35,
          strokeColor: enableShapeDrawing ? "#059669" : "#2563eb",
          strokeWeight: enableShapeDrawing ? 2 : 3,
          clickable: false,
        });

        if (!enableShapeDrawing) {
          const b = new google.maps.LatLngBounds();
          paths.forEach((p) => b.extend(p));
          map.fitBounds(b);
        }

        return () => poly.setMap(null);
      }
    } catch (e) {
      console.error("Error rendering existing polygon", e);
    }
  }, [map, existingPolygon, enableShapeDrawing]);

  /** SearchBox setup **/
  useEffect(() => {
    if (!map || !showSearchBox || !searchInputRef.current || !window.google?.maps?.places) return;

    const sb = new google.maps.places.SearchBox(searchInputRef.current);
    searchBoxRef.current = sb;

    const boundsListener = map.addListener("bounds_changed", () => {
      const b = map.getBounds();
      if (b) sb.setBounds(b);
    });

    const placesListener = sb.addListener("places_changed", () => {
      const places = sb.getPlaces();
      if (!places?.length) return;

      const place = places[0];
      const loc = place.geometry?.location;
      if (!loc) return;

      ignoreReverseGeocode.current = false;
      handleManualLocationUpdate(loc.lat(), loc.lng(), true);
      legacyMarkerRef.current?.setPosition(loc);

      if (place.geometry?.viewport) map.fitBounds(place.geometry.viewport);
      else {
        map.setCenter(loc);
        map.setZoom(17);
      }

      setSearchQuery("");
      setShowSearchBox(false);
    });

    return () => {
      google.maps.event.removeListener(boundsListener);
      google.maps.event.removeListener(placesListener);
    };
  }, [map, showSearchBox, handleManualLocationUpdate]);

  /** Reverse geocode callback **/
  useEffect(() => {
    if (reverseGeocodeData && onReverseGeocodeRef.current && !ignoreReverseGeocode.current) {
      onReverseGeocodeRef.current(reverseGeocodeData);
    }
  }, [reverseGeocodeData, onReverseGeocodeRef]);

  /** Controls **/
  const handleRecenter = useCallback(() => {
    if (!map) return;
    map.panTo(markerPos);
    map.setZoom(12);
  }, [map, markerPos]);

  const handleZoomIn = useCallback(() => {
    if (!map) return;
    map.setZoom((map.getZoom() || 7) + 1);
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (!map) return;
    map.setZoom((map.getZoom() || 7) - 1);
  }, [map]);

  const onAdvancedDragEnd = useCallback(
    (e: any) => {
      const lat = e?.latLng?.lat?.();
      const lng = e?.latLng?.lng?.();
      if (typeof lat === "number" && typeof lng === "number") {
        ignoreReverseGeocode.current = false;
        handleManualLocationUpdate(lat, lng, true);
      }
    },
    [handleManualLocationUpdate]
  );

  /** Current level indicator **/
  const currentLevel = useMemo(() => {
    if (addressCodes.villageId) return { level: "Village", Icon: MapPin, colorClass: "text-red-600" };
    if (addressCodes.communeId) return { level: "Commune", Icon: Building2, colorClass: "text-purple-600" };
    if (addressCodes.districtId) return { level: "District", Icon: Building, colorClass: "text-orange-600" };
    if (addressCodes.provinceId) return { level: "Province", Icon: Home, colorClass: "text-blue-600" };
    return { level: "Country", Icon: MapPinned, colorClass: "text-green-600" };
  }, [addressCodes]);

  return (
    <>
      {!!mapId && showMarker && <AdvancedMarker position={markerPos} draggable onDragEnd={onAdvancedDragEnd} />}

      {overlayEl &&
        createPortal(
          <div className="absolute inset-0 z-20 pointer-events-none">
            <SearchBoxUI
              show={canUsePlacesSearch && showSearchBox}
              value={searchQuery}
              onChange={setSearchQuery}
              onClose={() => {
                setShowSearchBox(false);
                setSearchQuery("");
              }}
              inputRef={searchInputRef}
            />

            <DrawingToolsUI
              show={enableShapeDrawing && !isInStreetView}
              drawingMode={drawingMode}
              setDrawingMode={setDrawingMode}
              canUndo={shapeHistory.length > 0}
              onUndo={undoLastAction}
              shapeCount={shapeMetas.length}
              shapes={shapeMetas}
              onRemove={removeShape}
              onClearAll={clearAllShapes}
            />

            <LevelBadgeUI level={currentLevel.level} Icon={currentLevel.Icon} colorClass={currentLevel.colorClass} hidden={isInStreetView || enableShapeDrawing} />
            
            <PinValidationBadgeUI isPinInsideShape={isPinInsideShape} hidden={!enableShapeDrawing || isInStreetView} />

            <RightControlsUI
              canUsePlacesSearch={canUsePlacesSearch}
              showSearchBox={showSearchBox}
              onToggleSearch={() => setShowSearchBox((v) => !v)}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onRecenter={handleRecenter}
              onPegman={togglePegmanAtPin}
              onToggleStreetLayer={toggleStreetViewLayer}
              showStreetViewLayer={showStreetViewLayer}
              isInStreetView={isInStreetView}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
            />

            <MapTypeSwitcherUI mapType={currentMapType} onChange={handleMapTypeChange} />

            <LegendUI show={showLegend} onToggle={() => setShowLegend((v) => !v)} />

            <CoordinatesUI show={showCoordinates} onToggle={() => setShowCoordinates((v) => !v)} lat={currentCoords.latitude} lng={currentCoords.longitude} />

            <ToastUI toast={toast} />

            {!mapId && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-yellow-50 border border-yellow-300 text-yellow-900 px-3 py-2 rounded-lg text-xs shadow pointer-events-none">
                No <b>mapId</b> provided — using legacy google.maps.Marker fallback.
              </div>
            )}
          </div>,
          overlayEl
        )}
    </>
  );
};
