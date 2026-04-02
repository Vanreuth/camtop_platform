// src/types/googleMap.types.ts

export type ShapeType = "polygon" | "rectangle" | "circle" | null;

export type AddressData = {
  provinceId: string | null;
  districtId: string | null;
  communeId: string | null;
  villageId: string | null;
};

export type DrawnShape = {
  id: string;
  type: "polygon" | "rectangle" | "circle";
  // actual google maps overlay object
  shape: google.maps.Polygon | google.maps.Rectangle | google.maps.Circle;
};

export type MapTypeId = "roadmap" | "satellite" | "hybrid" | "terrain";

export interface GoogleMapGISProps {
  coordinates: { latitude: number; longitude: number };
  addressCodes: AddressData;

  onCoordinatesChange?: (coords: { latitude: number; longitude: number }) => void;
  onAddressCodesChange?: (address: AddressData) => void;
  onReverseGeocode?: (data: any) => void;

  googleMapsApiKey?: string;
  mapId?: string;
  height?: string;

  enableShapeDrawing?: boolean;
  onShapesChange?: (shapes: DrawnShape[]) => void;
  existingPolygon?: { type: string; coordinates: number[][][] } | null;

  disableBoundaryPinUpdate?: boolean;

  // ✅ new
  mapType?: MapTypeId;
  onMapTypeChange?: (t: MapTypeId) => void;
  showMarker?: boolean;
  onMapLoad?: (map: google.maps.Map) => void;
}
