import type { Pagination } from "@/utils/helpers";

// --- Enums & Scalar Types ---

// Valuation Status - business state of the valuation
export type ValuationStatus =
  | "ACTIVE"
  | "SUPERSEDED"
  | "EXPIRED"
  | "CANCELLED";

export type PropertyValuationStatus = ValuationStatus;

// Workflow Status - workflow state
export type WorkflowStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED";

export type ValuationMethod = 
  | "SALES_COMPARISON_METHOD"
  | "COST_METHOD"
  | "INCOME_METHOD"
  | "RESIDUAL_METHOD"
  | string; // Allow string for flexibility if new methods added

export type CurrencyCode = string;
export type TitleType = string;
export type SourceType = string;
export type PropertyStatus = string;

// --- Shared Property Sub-Types ---
export type PropertyAddressInput = {
  provinceId: string;
  districtId: string;
  communeId: string;
  villageId: string | null;
  street: string | null;
  houseNo: string | null;
  titleAddress?: string | null;
  accessRoads?: string | null;
  neighborLocation?: string | null;
};

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: Array<Array<[number, number]>>;
};

export type PropertyLocationInput = {
  latitude?: number | string;
  longitude?: number | string;
  googlePoint?: string;
  geolocationLink?: string;
  formattedAddress?: string;
  placeId?: string;
  polygon?: string | GeoJsonPolygon | null;
};

export type DataSourceInput = {
  sourceType: SourceType;
  contactName?: string;
  phoneNumber?: string;
};

export type TitleDocumentInput = {
  titleDeedType: TitleType;
  titleDeedNo?: string | null;
  issuedYear?: string | null;
  parcelNo?: string | null;
  totalSizeByTitleDeed?: number | null;
  coverPhotoUrl?: string;
  backSidePhotoUrl?: string;
};

export type PropertyPhotosInput = {
  frontSide?: string | null;
  inside?: string | null;
  leftSide?: string | null;
  rightSide?: string | null;
  opposite?: string | null;
  gallery?: string[] | null;
};

// --- Inputs ---

export type CreatePropertyForValuationInput = {
  propertyTypeId: number;
  propertySubtypeId?: number;
  currentUseId?: number;
  propertyName?: string;
  status?: PropertyStatus;
  workflowStatus?: WorkflowStatus;
  description?: string;
  propertyAddress?: PropertyAddressInput;
  propertyLocation?: PropertyLocationInput;
  dataSource?: DataSourceInput;
  titleDocument?: TitleDocumentInput;
  propertyPhotos?: PropertyPhotosInput;
};

export type CreatePropertyValuationInput = {
  propertyId?: number;
  property?: CreatePropertyForValuationInput;
  valuationNo?: string;
  landValue?: number;
  buildingValue?: number;
  marketValue?: number;
  forcedSaleValue?: number;
  pricePerSqm?: number;
  dateOfInspection?: string | Date;
  valuationMethod?: ValuationMethod;
  currency?: CurrencyCode;
  valuationDate?: string | Date;
  dateOfReport?: string | Date;
  valuerId?: number;
  inspectorName?: string;
  status?: ValuationStatus;
  workflowStatus?: WorkflowStatus;
  purposeOfValuation?: string;
  note?: string;
  preparedFor?: string;
  internalNotes?: string;
  valuationPdf?: File | null;
};

// Updated to allow nested property updates
export type UpdatePropertyValuationInput = Partial<
  Omit<CreatePropertyValuationInput, "property" | "valuationPdf">
> & {
  propertyId?: number;
  // We explicitly allow updating property details nested inside the valuation update
  property?: Partial<CreatePropertyForValuationInput>; 
  status?: ValuationStatus;
};

export type ApproveValuationInput = {
  notes?: string;
};

export type RejectValuationInput = {
  rejectionReason: string;
};

// New Reassign Input
export type ReassignValuationInput = {
  newValuerId: number;
};

// --- Responses & Summaries ---

export type UserSummary = {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  profileImage?: string;
};

export type PropertyAddressSummary = {
  province?: { provinceId: number; provinceName?: string; nameKh?: string; nameEn?: string };
  district?: { districtId: number; districtName?: string; nameKh?: string; nameEn?: string };
  commune?: { communeId: number; communeName?: string; nameKh?: string; nameEn?: string };
  village?: { villageId: number; villageName?: string; nameKh?: string; nameEn?: string };
  street?: string;
  houseNo?: string;
};

export type PropertySummary = {
  propertyId: number;
  propertyCode?: string;
  propertyName?: string;
  propertyType?: { propertyTypeId: number; propertyName: string };
  currentUse?: { useId: number; useName?: string };
  propertyAddress?: PropertyAddressSummary;
  propertyLocation?: any;
  dataSource?: any;
  titleDocument?: any;
  propertyPhotos?: PropertyPhotosInput;
  propertySubtype?:any;
  status?: PropertyStatus;
};

export type ValuationDocument = {
  documentId?: number;
  version?: number;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  storageKey?: string;
  uploadedById?: number | null;
  createdAt?: string;
};

export type PropertyValuation = {
  id: number;
  valuationId: number;
  valuationNo?: string | null;
  propertyId: number;
  property?: PropertySummary | null;
  landValue?: number | null;
  buildingValue?: number | null;
  marketValue?: number | null;
  forcedSaleValue?: number | null;
  pricePerSqm?: number | null;
  dateOfInspection?: string | null;
  valuationMethod?: ValuationMethod | null;
  currency?: CurrencyCode | null;
  valuationDate?: string | null;
  dateOfReport?: string | null;
  valuerId?: number | null;
  inspectorName?: string | null;
  status?: ValuationStatus | null;
  workflowStatus?: WorkflowStatus | null;
  purposeOfValuation?: string | null;
  note?: string | null;
  internalNotes?: string | null;
  submittedAt?: string | null;
  submittedById?: number | null;
  submittedBy?: UserSummary | null;
  approvedAt?: string | null;
  approvedById?: number | null;
  approved?: UserSummary | null;
  rejectedAt?: string | null;
  rejectedById?: number | null;
  rejected?: UserSummary | null;
  rejectionReason?: string | null;
  preparedFor?: string | null;
  valuer?: UserSummary | null;
  approver?: UserSummary | null;
  rejecter?: UserSummary | null;
  documents?: ValuationDocument[];
  lastestDocument?: ValuationDocument | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PropertyValuationListResult = {
  valuations: PropertyValuation[];
  pagination: Pagination;
  message?: string;
};

export type ValuationStatistics = {
  totalValuations: number;
  averageValue: number;
  minValue: number;
  maxValue: number;
  statusCounts: Record<string, number>;
};

export type PropertyValuationQueryParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  status?: ValuationStatus;
  workflowStatus?: WorkflowStatus;
  valuationMethod?: ValuationMethod;
  preparedFor?: string;
  purposeOfValuation?: string;
  propertyId?: number;
  valuerId?: number;
  approvedById?: number;
  valuationDateFrom?: Date | string;
  valuationDateTo?: Date | string;
  minValue?: number;
  maxValue?: number;
  // Aliases for helper functions
  createdAfter?: Date | string;
  createdBefore?: Date | string;
  minPrice?: number;
  maxPrice?: number;
};

export interface ValuationStatisticsFilters {
  propertyTypeId?: number;
  valuationMethod?: ValuationMethod;
  status?: PropertyValuationStatus;
  workflowStatus?: WorkflowStatus;
  yearFrom?: number;
  yearTo?: number;
  valuerId?: number;
  provinceId?: number;
}
