import type { Pagination } from "@/utils/helpers";
import type {
  CurrencyCode,
  CreatePropertyForValuationInput,
  PropertySummary,
  PropertyValuationStatus,
  UserSummary,
  WorkflowStatus,
} from "@/hooks/propertyValuation/propertyValuation.types";

export type IndicativeValuationComponent = {
  id: number;
  valuationId: number;
  indicationId?: number;
  componentType?: "LAND" | "BUILDING" | "OTHER";
  description?: string | null;
  area: number | string;
  unit: string;
  minRate: number | string;
  maxRate: number | string;
  minValue: number | string;
  maxValue: number | string;
  createdAt?: string;
  updatedAt?: string;
};

export type IndicativeValuationComponentInput = {
  componentType?: "LAND" | "BUILDING" | "OTHER";
  description?: string;
  area?: number;
  unit?: string;
  minRate: number;
  maxRate: number;
};

export type IndicativeValuation = {
  id: number;
  valuationId: number;
  indicationId?: number;
  indicationNo?: string | null;
  valuationNo?: string | null;
  propertyId: number;
  property?: PropertySummary | null;
  currency?: CurrencyCode | null;
  instructionDate?: string | null;
  indicationDate?: string | null;
  valuationDate?: string | null;
  dateOfInspection?: string | null;
  instructedBy?: string | null;
  contactName?: string | null;
  contactTel?: string | null;
  chargeFee?: number | null;
  dateOfReport?: string | null;
  expiryDate?: string | null;
  preparedFor?: string | null;
  intendedUse?: string | null;
  purposeOfValuation?: string | null;
  note?: string | null;
  internalNotes?: string | null;
  valuerId?: number | null;
  inspectorName?: string | null;
  status?: PropertyValuationStatus | null;
  workflowStatus?: WorkflowStatus | null;
  rejectionReason?: string | null;
  valuer?: UserSummary | null;
  approved?: UserSummary | null;
  rejected?: UserSummary | null;
  createdByUser?: UserSummary | null;
  indicativeComponents?: IndicativeValuationComponent[];
  minMarketValue?: number | null;
  maxMarketValue?: number | null;
  totalIndicativeMinValue?: number | null;
  totalIndicativeMaxValue?: number | null;
  forcedSalePercent?: number | null;
  forcedSaleValue?: number | null;
  indicativePdfFileName?: string | null;
  indicativePdfMimeType?: string | null;
  indicativePdfFileSize?: number | null;
  indicativePdfGeneratedAt?: string | null;
  hasIndicativePdf?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type IndicativePdfDocument = {
  indicationId: number;
  valuationId: number;
  indicationNo?: string | null;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  generatedAt?: string | null;
  publicUrl?: string;
  viewUrl: string;
  downloadUrl: string;
};

export type CreateIndicativeValuationInput = {
  propertyId?: number;
  property?: CreatePropertyForValuationInput;
  indicationNo?: string;
  valuationNo?: string;
  currency?: CurrencyCode;
  status?: PropertyValuationStatus;
  workflowStatus?: WorkflowStatus;
  instructedBy?: string;
  preparedFor?: string;
  contactName?: string;
  contactTel?: string;
  chargeFee?: number | null;
  valuerId?: number;
  inspectorName?: string;
  instructionDate?: string | Date;
  indicationDate?: string | Date;
  dateOfInspection?: string | Date;
  valuationDate?: string | Date;
  dateOfReport?: string | Date;
  expiryDate?: string | Date;
  intendedUse?: string;
  purposeOfValuation?: string;
  forcedSalePercent?: number | null;
  note?: string;
  internalNotes?: string;
  componentType?: "LAND" | "BUILDING" | "OTHER";
  description?: string;
  area?: number;
  unit?: string;
  minRate: number;
  maxRate: number;
};

export type UpdateIndicativeValuationInput = {
  propertyId?: number;
  property?: Partial<CreatePropertyForValuationInput>;
  indicationNo?: string;
  valuationNo?: string;
  currency?: CurrencyCode;
  workflowStatus?: WorkflowStatus;
  instructedBy?: string;
  preparedFor?: string;
  contactName?: string;
  contactTel?: string;
  chargeFee?: number | null;
  valuerId?: number;
  inspectorName?: string;
  instructionDate?: string | Date;
  indicationDate?: string | Date;
  dateOfInspection?: string | Date;
  valuationDate?: string | Date;
  dateOfReport?: string | Date;
  expiryDate?: string | Date;
  intendedUse?: string;
  purposeOfValuation?: string;
  forcedSalePercent?: number | null;
  note?: string;
  internalNotes?: string;
  status?: PropertyValuationStatus;
  componentType?: "LAND" | "BUILDING" | "OTHER";
  description?: string;
  area?: number;
  unit?: string;
  minRate?: number;
  maxRate?: number;
};

export type CreateIndicativeComponentInput = IndicativeValuationComponentInput;

export type UpdateIndicativeComponentInput = Partial<IndicativeValuationComponentInput>;

export type ApproveIndicativeValuationInput = {
  notes?: string;
};

export type RejectIndicativeValuationInput = {
  rejectionReason: string;
};

export type ReassignIndicativeValuationInput = {
  newValuerId: number;
  reason?: string;
};

export type IndicativeValuationQueryParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  propertyId?: number;
  propertyTypeId?: number;
  instructedBy?: string;
  preparedFor?: string;
  intendedUse?: string;
  purposeOfValuation?: string;
  provinceId?: string;
  districtId?: string;
  communeId?: string;
  villageId?: string;
  minMarketValue?: number;
  maxMarketValue?: number;
  valuerId?: number;
  status?: PropertyValuationStatus;
  workflowStatus?: WorkflowStatus;
  createdAfter?: string | Date;
  createdBefore?: string | Date;
};

export type IndicativeValuationListResult = {
  valuations: IndicativeValuation[];
  pagination: Pagination;
  message?: string;
};
