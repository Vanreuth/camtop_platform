import type { PhysicalCondition } from "@/utils/physicalCondition";

export interface Property {
  id: number; // Required by DataTable
  propertyId: number;
  propertyCode: string;
  propertyName: string;
  status: string;
  workflowStatus: string;
  propertyType: {
    propertyTypeId: number;
    propertyName: string;
    recordType: {
      recordTypeId: number;
      recordName: string;
    };
  };
  propertySubtype?: {
    propertySubtypeId: number;
    subtypeName: string;
  };
  currentUse?: {
    useId: number;
    useName: string;
  };
  propertyAddress?: {
    villageName?: string;
    street?: string;
    houseNo?: string;
    province: {
      provinceId: number;
      provinceName: string;
    };
    district: {
      districtId: number;
      districtName: string;
    };
    commune: {
      communeId: number;
      communeName: string;
    };
  };
  propertyValuation?: Array<{
    valuationId: number;
    valuationDate: string;
    listPrice: number;
  }>;
  Transaction?: Array<{
    transactionId: number;
    transactionType: string;
    transactionDate: string;
    totalPrice: string | number;
    newBuildingCost?: string | number;
    depreciationAmount?: string | number;
    currentBuildingValue?: string | number;
    residualLandValue?: string | number;
    pricePerSqm?: string | number;
    valuationId?: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
  land?: {
    landId: number;
    landAreaSqm: number;
    widthMeters: number;
    lengthMeters: number;
  };
  building?: {
    buildingId: number;
    grossAreaSqm: number;
    numberOfStorey: number;
  };
  createdAt: string;
  updatedAt: string;
  createdBy?: number;
  updatedBy?: number;
  approvedBy?: number;
  rejectedBy?: number;
  rejectionReason?: string;
  createdByUser?: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string | null;
    phone: string;
  };
}

/**
 * Property Workflow Input Types
 */
export type ApprovePropertyInput = {
  notes?: string;
};

export type RejectPropertyInput = {
  reason: string;
};
export interface PropertyType {
  propertyTypeId: number;
  propertyName: string;
  recordTypeId: number;
  recordType: {
    recordTypeId: number;
    recordName: string;
  };
  subtypes: Array<{
    propertySubtypeId: number;
    subtypeName: string;
  }>;
  currentUses: Array<{
    useId: number;
    currentUse: {
      useId: number;
      useName: string;
    };
  }>;
  buildingSubtypes: Array<{
    buildingSubtypeId: number;
    subtypeName: string;
  }>;
}

export interface UnitData {
  unitNo: string;
  unitType: string;
  floorNo: string;
  floorAreaSqm: string;
  totalAreaSqm: string;
  numberOfBedrooms: string;
  numberOfBathrooms: string;
  hasKitchen: boolean;
  hasLivingRoom: boolean;
  hasParkingSpace: boolean;
  constructedYear: string;
  usefulLife: string;
  effectiveAge: string;
  costPerSqm: string;
  replacementCostPerSqm: string;
  totalBuildingCost: string;
  physical_condition: PhysicalCondition | "";
  managementFee: string;
  viewType: string;
}

export interface BuildingData {
  buildingName: string;
  buildingSubtypeId: string;
  width: string;
  length: string;
  numberOfStorey: string;
  grossAreaSqm: string;
  bedroom: string;
  bathroom: string;
  livingroom: string;
  kitchen: string;
  diningroom: string;
  totalRoom: string;
  parkingSpace: string;
  constructionYear: string;
  effectiveAge: string;
  usefulLife: string;
  replacementCostPerSqm: string;
  constructionPercentage: string;
  physical_condition: PhysicalCondition | "";
  totalBuildingCost: string;
  depreciation: string;
  currentBuildingValue: string;
  costPerSqm: string;
  percentageOfConstruction: string | number;
  viewType: string;
  status: string;
  totalUnits: string;
  units: UnitData[];
}
export interface UnitData {
  unitNo: string;
  unitType: string;
  floorNo: string;
  floorAreaSqm: string;
  totalAreaSqm: string;
  numberOfBedrooms: string;
  numberOfBathrooms: string;
  hasKitchen: boolean;
  hasLivingRoom: boolean;
  hasParkingSpace: boolean;
  constructedYear: string;
  usefulLife: string;
  effectiveAge: string;
  costPerSqm: string;
  replacementCostPerSqm: string;
  totalBuildingCost: string;
  physical_condition: PhysicalCondition | "";
  managementFee: string;
  viewType: string;
}

export type AddressCodes = {
  provinceId: string | null;
  districtId: string | null;
  communeId: string | null;
  villageId: string | null;
};

export interface PropertyFormData {
  propertyName: string;
  propertyTypeId: string;
  propertySubtypeId: string;
  currentUseId: string;
  status: string;
  description: string;
  provinceId: string;
  districtId: string;
  communeId: string;
  villageId: string;
  street: string;
  houseNo: string;
  latitude: string;
  longitude: string;
  formattedAddress: string;
  placeId: string;
  widthMeters: string;
  lengthMeters: string;
  landAreaSqm: string;
  totalFloors: string;
  builtYear: string;
  buildingAreaSqm: string;
  floorAreaSqm: string;
  bedrooms: string;
  bathrooms: string;
  landShape: string;
  topography: string;
  sitePosition: string;
  waterSource: string;
  typeofTree: string;
  numberOfTrees: string;
  ageOfTrees: string;
  buildings: BuildingData[];
  titleDeedType: string;
  titleDeedNo: string;
  issuedYear: string;
  parcelNo: string;
  totalSizeByTitleDeed: string;
  sourceType: string;
  contactName: string;
  phoneNumber: string;
  transactionType: string;
  transactionDate: string;
  totalPrice: string;
}

export interface PhotoState {
  front: File | null;
  back: File | null;
  left: File | null;
  right: File | null;
  titleDeed: File | null;
  gallery: File[];
  buildingImages: Array<{ buildingIndex: number; file: File }>;
}

export interface PhotoPreviewState {
  front: string;
  back: string;
  left: string;
  right: string;
  titleDeed: string;
  gallery: string[];
  buildingImages: Array<{ buildingIndex: number; preview: string }>;
}

export interface PropertyType {
  propertyTypeId: number;
  propertyName: string;
  recordTypeId: number;
  recordType: {
    recordTypeId: number;
    recordName: string;
  };
  subtypes: Array<{
    propertySubtypeId: number;
    subtypeName: string;
  }>;
  currentUses: Array<{
    useId: number;
    currentUse: {
      useId: number;
      useName: string;
    };
  }>;
  buildingSubtypes: Array<{
    buildingSubtypeId: number;
    subtypeName: string;
  }>;
}

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

export interface ApiParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  propertyName?: string;
  propertyCode?: string;
  propertyTypeId?: number;
  propertySubtypeId?: number;
  status?: string;
  workflowStatus?: string;
  provinceId?: number;
  districtId?: number;
  communeId?: number;
  villageId?: number;
  minPrice?: number;
  maxPrice?: number;
  minLandArea?: number;
  maxLandArea?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

export type PropertySearchFilters = {
  propertyTypeId?: number;
  status?: string;
  workflowStatus?: string;
  minPrice?: number;
  maxPrice?: number;
  minLandArea?: number;
  maxLandArea?: number;
};

export type GeoCoordinate = {
  latitude: number;
  longitude: number;
};

export type PropertySearchCircleParams = {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  filters?: PropertySearchFilters;
};

export type PropertySearchPolygonParams = {
  coordinates: GeoCoordinate[];
  filters?: PropertySearchFilters;
};

export type PropertySearchParams =
  | { mode: "circle"; params: PropertySearchCircleParams }
  | { mode: "polygon"; params: PropertySearchPolygonParams };
