import api from "@/lib/api";
import {
  getApiSuccessMessage,
  unwrap,
  unwrapPage,
  type Pagination,
} from "@/utils/helpers";
import type {
  ApproveValuationInput,
  CreatePropertyValuationInput,
  PropertyValuation,
  PropertyValuationListResult,
  PropertyValuationQueryParams,
  ReassignValuationInput,
  RejectValuationInput,
  UpdatePropertyValuationInput,
  ValuationStatisticsFilters
} from "./propertyValuation.types";

export type ImportRowError = {
  row: number;
  message: string;
};

export type ImportSummary = {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  errors: ImportRowError[];
};

export type ApiResponseWithMessage<T> = T & {
  _responseMessage?: string;
};

type ValuationPayload = PropertyValuation | { valuation: PropertyValuation };
type ValuationStatisticsResponse = {
  success?: boolean;
  message?: string;
  data?: {
    overview?: {
      totalValuations?: number;
      totalMarketValue?: number;
      totalLandValue?: number;
      totalBuildingValue?: number;
      averageMarketValue?: number;
      averageLandValue?: number;
      averageBuildingValue?: number;
      averageForcedSaleValue?: number;
      minValue?: number;
      maxValue?: number;
    };
    workflow?: {
      draft?: number;
      pending?: number;
      inReview?: number;
      approved?: number;
      rejected?: number;
      avgApprovalDays?: number | null;
      approvalRate?: number;
    };
    byStatus?: Record<string, number>;
    byMethod?: Array<{ method?: string; count?: number }>;
    byPropertyType?: Array<{
      propertyTypeId?: number;
      propertyTypeName?: string;
      count?: number;
    }>;
    byValuer?: Array<{
      valuerId?: number | null;
      valuerName?: string;
      count?: number;
      avgMarketValue?: number;
    }>;
    byProvince?: Array<{
      provinceId?: string;
      provinceName?: string;
      count?: number;
    }>;
    trends?: {
      monthly?: Array<{
        month?: string | number;
        count?: number;
        avgValue?: number;
      }>;
    };
  };
};
type DownloadDocumentPayload = {
  downloadUrl?: string;
  viewUrl?: string;
  fileName?: string;
  normalizedFileName?: string;
  data?: {
    downloadUrl?: string;
    viewUrl?: string;
    fileName?: string;
    normalizedFileName?: string;
  };
};

const normalizeValuation = (payload: ValuationPayload): PropertyValuation => {
  const valuation = "valuation" in payload ? payload.valuation : payload;
  const approver = valuation.approver ?? valuation.approved ?? null;
  const rejecter = valuation.rejecter ?? valuation.rejected ?? null;
  const submittedBy = valuation.submittedBy ?? valuation.valuer ?? null;

  return {
    ...valuation,
    id: valuation.id ?? valuation.valuationId,
    approver,
    approved: approver,
    rejecter,
    rejected: rejecter,
    submittedBy,
    submittedAt: valuation.submittedAt ?? valuation.createdAt ?? null,
    approvedById: valuation.approvedById ?? approver?.id ?? null,
    rejectedById: valuation.rejectedById ?? rejecter?.id ?? null,
  };
};

const coerceDate = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const mapQueryParams = (params: PropertyValuationQueryParams) => {
  const mapped: Record<string, unknown> = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "All") {
      return;
    }

    let apiKey = key;

    if (key === "createdAfter") apiKey = "valuationDateFrom";
    if (key === "createdBefore") apiKey = "valuationDateTo";
    if (key === "minPrice") apiKey = "minValue";
    if (key === "maxPrice") apiKey = "maxValue";

    mapped[apiKey] = coerceDate(value);
  });

  return mapped;
};

const buildQueryString = (params: PropertyValuationQueryParams): string => {
  const cleaned = mapQueryParams(params);

  return new URLSearchParams(
    Object.entries(cleaned).map(([key, value]) => [key, String(value)])
  ).toString();
};

const cleanStringFilter = <T extends string>(value?: T): T | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "all") return undefined;
  return trimmed as T;
};

const cleanNumberFilter = (value?: number): number | undefined => {
  if (typeof value !== "number") return undefined;
  return Number.isFinite(value) ? value : undefined;
};

const normalizeStatisticsFilters = (
  filters?: ValuationStatisticsFilters
): ValuationStatisticsFilters => {
  const normalized: ValuationStatisticsFilters = {};

  const propertyTypeId = cleanNumberFilter(filters?.propertyTypeId);
  const yearFrom = cleanNumberFilter(filters?.yearFrom);
  const yearTo = cleanNumberFilter(filters?.yearTo);
  const valuerId = cleanNumberFilter(filters?.valuerId);
  const provinceId = cleanNumberFilter(filters?.provinceId);
  const valuationMethod = cleanStringFilter(filters?.valuationMethod);
  const status = cleanStringFilter(filters?.status);
  const workflowStatus = cleanStringFilter(filters?.workflowStatus);

  if (propertyTypeId) normalized.propertyTypeId = propertyTypeId;
  if (valuerId) normalized.valuerId = valuerId;
  if (provinceId) normalized.provinceId = provinceId;
  if (valuationMethod) normalized.valuationMethod = valuationMethod;
  if (status) normalized.status = status;
  if (workflowStatus) normalized.workflowStatus = workflowStatus;
  if (yearFrom) normalized.yearFrom = yearFrom;
  if (yearTo) normalized.yearTo = yearTo;

  if (
    typeof normalized.yearFrom === "number" &&
    typeof normalized.yearTo === "number" &&
    normalized.yearFrom > normalized.yearTo
  ) {
    const temp = normalized.yearFrom;
    normalized.yearFrom = normalized.yearTo;
    normalized.yearTo = temp;
  }

  return normalized;
};

const normalizeStatisticsResponse = (
  payload: unknown
): ValuationStatisticsResponse => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const response = payload as ValuationStatisticsResponse;
  const workflow = response.data?.workflow;

  if (!workflow) {
    return response;
  }

  return {
    ...response,
    data: {
      ...response.data,
      workflow: {
        ...workflow,
        // Backward compatibility for dashboards that still read `inReview`.
        inReview: workflow.inReview ?? workflow.pending ?? 0,
      },
    },
  };
};



const createFallbackPagination = (
  params: PropertyValuationQueryParams
): Pagination => {
  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 10);

  return {
    page,
    limit,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: page > 1,
  };
};

const buildExportQueryString = (filters?: Record<string, unknown>) => {
  if (!filters) return "";

  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "All") {
      return;
    }

    if (key === "page" || key === "limit" || key === "sortBy" || key === "sortOrder") {
      return;
    }

    let apiKey = key;

    if (key === "createdAfter") apiKey = "valuationDateFrom";
    if (key === "createdBefore") apiKey = "valuationDateTo";
    if (key === "minPrice") apiKey = "minValue";
    if (key === "maxPrice") apiKey = "maxValue";

    query.append(apiKey, String(coerceDate(value)));
  });
  return query.toString();
};

const getFileNameFromContentDisposition = (
  contentDisposition?: string,
  fallback = "property-valuations-export.xlsx"
) => {
  if (!contentDisposition) return fallback;
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(contentDisposition);
  if (!match?.[1]) return fallback;
  return decodeURIComponent(match[1]).replace(/"/g, "");
};

const toValuationFormData = (
  data: CreatePropertyValuationInput | UpdatePropertyValuationInput
) => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (key === "property" && typeof value === "object") {
      formData.append(key, JSON.stringify(value));
      return;
    }

    if (value instanceof Date) {
      formData.append(key, value.toISOString());
      return;
    }

    if (value instanceof File) {
      formData.append(key, value);
      return;
    }

    formData.append(key, String(value));
  });

  return formData;
};

const prepareCreatePayload = (data: CreatePropertyValuationInput | FormData) => {
  if (data instanceof FormData) {
    return {
      payload: data,
      config: { headers: { "Content-Type": "multipart/form-data" } },
    };
  }

  if (data.valuationPdf instanceof File) {
    return {
      payload: toValuationFormData(data),
      config: { headers: { "Content-Type": "multipart/form-data" } },
    };
  }

  return { payload: data, config: undefined };
};

export const propertyValuationApi = {
  getPropertyValuations: async (
    params: PropertyValuationQueryParams = { page: 0, limit: 0 }
  ): Promise<PropertyValuationListResult> => {
     // ... (Existing implementation) ...
      const queryString = buildQueryString(params);
      const url = queryString ? `/property-valuations?${queryString}` : "/property-valuations";
      const response = await api.get(url);
      const { data: responseData, pagination, message } = unwrapPage<{ valuations: PropertyValuation[] }>(response.data);
      const valuations = (responseData?.valuations ?? []).map((valuation) => normalizeValuation(valuation));
      return { valuations, pagination: pagination ?? createFallbackPagination(params), message };
  },

    getPropertyValuationById: async (id: number): Promise<ApiResponseWithMessage<PropertyValuation>> => {
    const response = await api.get(`/property-valuations/${id}`);
    const payload = unwrap<ValuationPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeValuation(payload),
      _responseMessage: message,
    };



    
},

getValuationStatistics: async (
    filters?: ValuationStatisticsFilters
  ): Promise<ValuationStatisticsResponse> => {
    const normalizedFilters = normalizeStatisticsFilters(filters);
    const params = new URLSearchParams();
    if (normalizedFilters.propertyTypeId) {
      params.append("propertyTypeId", String(normalizedFilters.propertyTypeId));
    }
    if (normalizedFilters.valuationMethod) {
      params.append("valuationMethod", normalizedFilters.valuationMethod);
    }
    if (normalizedFilters.status) {
      params.append("status", normalizedFilters.status);
    }
    if (normalizedFilters.workflowStatus) {
      params.append("workflowStatus", normalizedFilters.workflowStatus);
    }
    if (normalizedFilters.yearFrom) {
      params.append("yearFrom", String(normalizedFilters.yearFrom));
    }
    if (normalizedFilters.yearTo) {
      params.append("yearTo", String(normalizedFilters.yearTo));
    }
    if (normalizedFilters.valuerId) {
      params.append("valuerId", String(normalizedFilters.valuerId));
    }
    if (normalizedFilters.provinceId) {
      params.append("provinceId", String(normalizedFilters.provinceId));
    }
    
    const queryString = params.toString();
    const url = queryString ? `/property-valuations/statistics?${queryString}` : "/property-valuations/statistics";
    const response = await api.get(url);
    return normalizeStatisticsResponse(response.data);
  },


  createPropertyValuation: async (
    data: CreatePropertyValuationInput | FormData
  ): Promise<ApiResponseWithMessage<PropertyValuation>> => {
    const { payload, config } = prepareCreatePayload(data);
    const response = await api.post("/property-valuations", payload, config);
    const payloadData = unwrap<ValuationPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeValuation(payloadData),
      _responseMessage: message,
    };
  },

  updatePropertyValuation: async (
    id: number,
    data: UpdatePropertyValuationInput | FormData
  ): Promise<ApiResponseWithMessage<PropertyValuation>> => {
    const isFormData = data instanceof FormData;
    const payload = isFormData ? data : data;
    const config = isFormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;

    const response = await api.put(`/property-valuations/${id}`, payload, config);
    const payloadData = unwrap<ValuationPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeValuation(payloadData),
      _responseMessage: message,
    };
  },

  submitForReview: async (
    id: number
  ): Promise<ApiResponseWithMessage<PropertyValuation>> => {
    const response = await api.post(`/property-valuations/${id}/submit`, {});
    const payload = unwrap<ValuationPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeValuation(payload),
      _responseMessage: message,
    };
  },

  approveValuation: async (
    id: number,
    data: ApproveValuationInput
  ): Promise<ApiResponseWithMessage<PropertyValuation>> => {
    const response = await api.post(`/property-valuations/${id}/approve`, data);
    const payload = unwrap<ValuationPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeValuation(payload),
      _responseMessage: message,
    };
  },

  rejectValuation: async (
    id: number,
    data: RejectValuationInput
  ): Promise<ApiResponseWithMessage<PropertyValuation>> => {
    const response = await api.post(`/property-valuations/${id}/reject`, data);
    const payload = unwrap<ValuationPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeValuation(payload),
      _responseMessage: message,
    };
  },

  reassignValuation: async (
    id: number,
    data: ReassignValuationInput
  ): Promise<ApiResponseWithMessage<PropertyValuation>> => {
    // Note: Backend uses PATCH /:id/reassign
    const response = await api.patch(`/property-valuations/${id}/reassign`, data);
    const payload = unwrap<ValuationPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeValuation(payload),
      _responseMessage: message,
    };
  },

  deletePropertyValuation: async (id: number): Promise<{ message?: string }> => {
    const response = await api.delete(`/property-valuations/${id}`);
    const message = getApiSuccessMessage(response.data);

    return { message };
  },

  exportPropertyValuationsExcel: async (filters?: Record<string, unknown>) => {
    const queryString = buildExportQueryString(filters);
    const url = queryString
      ? `/property-valuations/export/excel?${queryString}`
      : "/property-valuations/export/excel";

    const response = await api.get(url, { responseType: "blob" });
    const contentDisposition = response.headers["content-disposition"] as
      | string
      | undefined;

    return {
      blob: response.data as Blob,
      fileName: getFileNameFromContentDisposition(contentDisposition),
    };
  },

  importPropertyValuationsExcel: async (
    file: File
  ): Promise<{ summary?: ImportSummary; _responseMessage?: string }> => {
    const formData = new FormData();
    formData.append("excelFile", file);

    const response = await api.post("/property-valuations/import/excel", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const data = unwrap<{ summary?: ImportSummary }>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...data,
      _responseMessage: message,
    };
  },

  downloadValuationDocument: async (id: number) => {
    const response = await api.get(`/property-valuations/${id}/document`);
    const responseData = response.data;
    const payload = unwrap<DownloadDocumentPayload>(responseData);

    const downloadUrl =
      payload?.downloadUrl ??
      payload?.data?.downloadUrl ??
      responseData?.data?.downloadUrl;

    const viewUrl =
      payload?.viewUrl ??
      payload?.data?.viewUrl ??
      responseData?.data?.viewUrl;

    const fileName =
      payload?.fileName ??
      payload?.normalizedFileName ??
      payload?.data?.fileName ??
      payload?.data?.normalizedFileName ??
      `valuation-${id}.pdf`;

    if (!downloadUrl) {
      throw new Error("Download URL missing");
    }

    return {
      downloadUrl,
      fileName,
      viewUrl,
    };
  },
};
