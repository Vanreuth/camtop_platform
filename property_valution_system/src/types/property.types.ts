import type { PhysicalCondition } from "@/utils/physicalCondition";

// Property Status (business state)
export type PropertyStatus = "SOLD" | "RENTED" | "RENTAL_SALE" | "ACTIVE" | "INACTIVE";

// Workflow Status (workflow state)
export type WorkflowStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";

export interface Property {
  id: number; // Required by DataTable
  propertyId: number;
  propertySubtypeId?: number | null;
  currentUseId?: number | null;
  propertyCode: string;
  propertyName: string;
  status: PropertyStatus | string;
  workflowStatus: WorkflowStatus | string;
  totalFloors?: number | null;
  builtYear?: number | null;
  landAreaSqm?: number | null;
  buildingAreaSqm?: number | null;
  floorAreaSqm?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  widthMeters?: number | null;
  lengthMeters?: number | null;
  propertyType: {
    propertyTypeId: number;
    propertyName: string;
    recordType: {
      recordTypeId: number;
      recordName: string;
    };
  };
  description?: string;
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
    provideId?: number;
    districtId?: number;
    communeId?: number;
    province: {
      provinceId: number;
      code: string;
      nameEn: string;
      nameKh: string;
    };
    district: {
      districtId: number;
      code: string;
      nameEn: string;
      nameKh: string;
    };
    commune: {
      code: string;
      communeId: number;
      nameEn: string;
      nameKh: string;
    };
    village: {
      code: string;
      villageId: number;
      nameEn: string;
      nameKh: string;
    }
  };
  propertyPhotos: any;
  propertyLocation: any;
  propertyValuation?: Array<{
    valuationId: number;
    valuationDate: string;
    listPrice: number;
  }>;
  transaction?: Array<{
    transactionId: number;
    transactionType: string;
    transactionDate: string;
    totalPrice:  number | string;
    newBuildingCost?: string | number;
    depreciationAmount?: string | number;
    currentBuildingValue?: string | number;
    residualLandValue?: string | number;
    pricePerSqm?: string | number;
    valuationId?: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
  titleDocument?:any;
  land?:any;
  agricultureLand?:any;
  building?:any
  buildingUnits?:any;
  dataSource?: any;
  createdAt: string;
  updatedAt: string;
  createdBy?: number | null;
  updatedBy?: number | null;
  approvedBy?: number | null;
  rejectedBy?: number | null;
  rejectionReason?: string | null;
  createdByUser?: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string | null;
    phone: string;
    status: string;
    email: string;
    lastLogin?: string | null;
  };
  approvedByUser?: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
  };
  rejectedByUser?: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
  };
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

export interface UnitData {
  buildingUnitId?: string;
  buildingId?: string;
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
  buildingId?: string;
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
  workflowStatus?: string;
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

export type NearbyAmenityItem = {
  name: string;
  distance?: number;
  rating?: number;
  address?: string;
  lat?: number;
  lng?: number;
  priceLevel?: number;
};

export type NearbyAmenities = {
  schools: NearbyAmenityItem[];
  hospitals: NearbyAmenityItem[];
  restaurants: NearbyAmenityItem[];
  banks: NearbyAmenityItem[];
  supermarkets: NearbyAmenityItem[];
};

export type NearbyProperty = {
  id: number;
  name?: string;
  code?: string;
  type?: string;
  distance?: number;
  price?: number;
  status?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

export type PropertyAnalysisSummary = {
  totalNearbySchools: number;
  totalNearbyHospitals: number;
  totalNearbyRestaurants: number;
  totalNearbyBanks: number;
  totalNearbySupermarkets: number;
  totalNearbyProperties: number;
  locationScore: number;
  locationRating: string;
};

export type PropertyAnalysis = {
  property?: {
    id?: number;
    name?: string;
    code?: string;
    type?: string;
    location?: unknown;
    address?: unknown;
  };
  summary: PropertyAnalysisSummary;
  nearbyAmenities: NearbyAmenities;
  nearbyProperties: NearbyProperty[];
};

/**
 * Property Workflow Input Types
 */
export type ApprovePropertyInput = {
  notes?: string;
};

export type RejectPropertyInput = {
  reason: string;
};

export interface PropertyStatisticsFilters {
  startDate?: string;
  endDate?: string;
  propertyTypeId?: number;
  provinceId?: number;
  status?: string;
}


