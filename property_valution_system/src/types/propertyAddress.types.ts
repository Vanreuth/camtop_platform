import { DrawnShape } from "./googleMap.types";

export interface Province {
  code: string;
  nameEn: string;
  nameKh: string;
}

export interface District {
  code: string;
  nameEn: string;
  nameKh: string;
  provinceCode: string;
}

export interface Commune {
  code: string;
  nameEn: string;
  nameKh: string;
  districtCode: string;
}

export interface Village {
  code: string;
  nameEn: string;
  nameKh: string;
  communeCode: string;
}

export interface ResolvedAddressItem {
  code: string;
  nameEn: string;
  nameKh: string;
}

export interface ResolvedAddressHierarchyItems {
  province: ResolvedAddressItem | null;
  district: ResolvedAddressItem | null;
  commune: ResolvedAddressItem | null;
  village: ResolvedAddressItem | null;
}

export interface ResolvePropertyAddressPayload {
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
}

export interface ResolvedPropertyAddress {
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  resolvedFormattedAddress: string | null;
  placeId: string | null;
  street: string | null;
  houseNumber: string | null;
  googleMapLink: string | null;
  provinceId: string | null;
  districtId: string | null;
  communeId: string | null;
  villageId: string | null;
  province: ResolvedAddressItem | null;
  district: ResolvedAddressItem | null;
  commune: ResolvedAddressItem | null;
  village: ResolvedAddressItem | null;
}

export interface PropertyAddressResponse<T> {
  status: string;
  message: string;
  data: T;
}

export interface AddressTabProps {
  formData: {
    provinceId: string;
    districtId: string;
    communeId: string;
    villageId: string;
    street: string;
    houseNo: string;
    latitude: string;
    longitude: string;
    formattedAddress: string;
  };
  addressCodes: {
    provinceId: string | null;
    districtId: string | null;
    communeId: string | null;
    villageId: string | null;
  };
  resolvedAddressItems?: ResolvedAddressHierarchyItems;
  onInputChange: (field: string, value: string) => void;
  onAddressChange: (codes: {
    provinceId: string | null;
    districtId: string | null;
    communeId: string | null;
    villageId: string | null;
  }) => void;
  onCoordinatesChange: (coords: { latitude: number; longitude: number }) => void;
  onReverseGeocode?: (data: any) => void;
  onShapesChange?: (shapes: DrawnShape[]) => void;
  isReverseGeocoding?: boolean;
  shapes?: DrawnShape[];
  existingPolygon?: { type: string; coordinates: number[][][] } | null;
  disableBoundaryPinUpdate?: boolean;
  enableShapeDrawing?: boolean;
  showMap?: boolean;
  mapHeight?: string;
  onReset?: () => void;
  t: (key: string) => string;
}
