import api from "@/lib/api";
import { getApiSuccessMessage, unwrap, unwrapPage, type Pagination } from "@/utils/helpers";
import type {
  ApproveIndicativeValuationInput,
  CreateIndicativeComponentInput,
  CreateIndicativeValuationInput,
  IndicativePdfDocument,
  IndicativeValuation,
  IndicativeValuationComponent,
  IndicativeValuationListResult,
  IndicativeValuationQueryParams,
  RejectIndicativeValuationInput,
  ReassignIndicativeValuationInput,
  UpdateIndicativeComponentInput,
  UpdateIndicativeValuationInput,
} from "./indicativeValuation.types";

export type ApiResponseWithMessage<T> = T & {
  _responseMessage?: string;
};

type RawIndicativeValuation = Partial<IndicativeValuation> & {
  indicationId?: number;
  valuationId?: number;
  propertyId?: number;
  indicativeComponents?: Array<Partial<IndicativeValuationComponent>>;
  minMarketValue?: number | string | null;
  maxMarketValue?: number | string | null;
  totalIndicativeMinValue?: number | string | null;
  totalIndicativeMaxValue?: number | string | null;
  forcedSalePercent?: number | string | null;
  forcedSaleValue?: number | string | null;
  indicativePdfFileName?: string | null;
  indicativePdfMimeType?: string | null;
  indicativePdfFileSize?: number | string | null;
  indicativePdfGeneratedAt?: string | null;
  hasIndicativePdf?: boolean;
};

type CreateIndicativeValuationPayload = {
  valuation?: RawIndicativeValuation;
  component?: Partial<IndicativeValuationComponent>;
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const coerceDate = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const buildQueryString = (params: IndicativeValuationQueryParams) => {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined && value !== null && value !== "" && value !== "All",
    ),
  );

  return new URLSearchParams(
    Object.entries(cleaned).map(([key, value]) => [key, String(coerceDate(value))]),
  ).toString();
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

    query.append(key, String(coerceDate(value)));
  });
  return query.toString();
};

const getFileNameFromContentDisposition = (
  contentDisposition?: string,
  fallback = "indicative-valuation-report.xlsx"
) => {
  if (!contentDisposition) return fallback;
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(contentDisposition);
  if (!match?.[1]) return fallback;
  return decodeURIComponent(match[1]).replace(/"/g, "");
};

const createFallbackPagination = (
  params: IndicativeValuationQueryParams,
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

const normalizeComponent = (
  component: Partial<IndicativeValuationComponent>,
): IndicativeValuationComponent => ({
  id: Number(component.id ?? 0),
  indicationId: Number(component.indicationId ?? component.valuationId ?? 0),
  valuationId: Number(component.valuationId ?? 0),
  description: component.description ?? null,
  componentType: component.componentType,
  area: toNumber(component.area) ?? 0,
  unit: component.unit ?? "sqm",
  minRate: toNumber(component.minRate) ?? 0,
  maxRate: toNumber(component.maxRate) ?? 0,
  minValue: toNumber(component.minValue) ?? 0,
  maxValue: toNumber(component.maxValue) ?? 0,
  createdAt: component.createdAt,
  updatedAt: component.updatedAt,
});

const normalizeIndicativeValuation = (
  payload: RawIndicativeValuation,
): IndicativeValuation => ({
  ...payload,
  id: Number(payload.id ?? payload.indicationId ?? payload.valuationId ?? 0),
  indicationId: Number(payload.indicationId ?? payload.id ?? payload.valuationId ?? 0),
  valuationId: Number(payload.valuationId ?? payload.indicationId ?? payload.id ?? 0),
  propertyId: Number(payload.propertyId ?? 0),
  minMarketValue: toNumber(payload.minMarketValue),
  maxMarketValue: toNumber(payload.maxMarketValue),
  totalIndicativeMinValue: toNumber(payload.totalIndicativeMinValue ?? payload.minMarketValue),
  totalIndicativeMaxValue: toNumber(payload.totalIndicativeMaxValue ?? payload.maxMarketValue),
  forcedSalePercent: toNumber(payload.forcedSalePercent),
  forcedSaleValue: toNumber(payload.forcedSaleValue),
  accessValue: toNumber(payload.accessValue),
  minAccessValue: toNumber(payload.minAccessValue),
  maxAccessValue: toNumber(payload.maxAccessValue),
  feeRate: toNumber(payload.feeRate),
  discount: toNumber(payload.discount),
  chargeFee: toNumber(payload.chargeFee),
  minChargeFee: toNumber(payload.minChargeFee),
  maxChargeFee: toNumber(payload.maxChargeFee),
  indicativePdfFileName: payload.indicativePdfFileName ?? null,
  indicativePdfMimeType: payload.indicativePdfMimeType ?? null,
  indicativePdfFileSize: toNumber(payload.indicativePdfFileSize),
  indicativePdfGeneratedAt: payload.indicativePdfGeneratedAt ?? null,
  hasIndicativePdf: Boolean(payload.hasIndicativePdf),
  indicativeComponents: Array.isArray(payload.indicativeComponents)
    ? payload.indicativeComponents.map(normalizeComponent)
    : [],
});

const normalizeCreatePayload = (
  payload: CreateIndicativeValuationPayload | RawIndicativeValuation,
): IndicativeValuation => {
  if (payload && typeof payload === "object" && "valuation" in payload) {
    const valuation = normalizeIndicativeValuation(payload.valuation ?? {});
    const firstComponent = payload.component
      ? [normalizeComponent(payload.component)]
      : [];

    return {
      ...valuation,
      indicativeComponents:
        valuation.indicativeComponents?.length ? valuation.indicativeComponents : firstComponent,
    };
  }

  return normalizeIndicativeValuation(payload as RawIndicativeValuation);
};

export const indicativeValuationApi = {
  getIndicativeValuations: async (
    params: IndicativeValuationQueryParams = { page: 1, limit: 10 },
  ): Promise<IndicativeValuationListResult> => {
    const queryString = buildQueryString(params);
    const url = queryString
      ? `/property-indicativeValuation?${queryString}`
      : "/property-indicativeValuation";

    const response = await api.get(url);
    const { data, pagination, message } = unwrapPage<RawIndicativeValuation[]>(response.data);

    return {
      valuations: Array.isArray(data) ? data.map(normalizeIndicativeValuation) : [],
      pagination: pagination ?? createFallbackPagination(params),
      message,
    };
  },

  getIndicativeValuationById: async (
    id: number,
  ): Promise<ApiResponseWithMessage<IndicativeValuation>> => {
    const response = await api.get(`/property-indicativeValuation/${id}`);
    const payload = unwrap<RawIndicativeValuation>(response.data);

    return {
      ...normalizeIndicativeValuation(payload),
      _responseMessage: getApiSuccessMessage(response.data),
    };
  },

  createIndicativeValuation: async (
    data: CreateIndicativeValuationInput | FormData,
  ): Promise<ApiResponseWithMessage<IndicativeValuation>> => {
    const config =
      data instanceof FormData
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : undefined;
    const response = await api.post("/property-indicativeValuation", data, config);
    const payload = unwrap<CreateIndicativeValuationPayload | RawIndicativeValuation>(response.data);

    return {
      ...normalizeCreatePayload(payload),
      _responseMessage: getApiSuccessMessage(response.data),
    };
  },

  updateIndicativeValuation: async (
    id: number,
    data: UpdateIndicativeValuationInput,
  ): Promise<ApiResponseWithMessage<IndicativeValuation>> => {
    const response = await api.patch(`/property-indicativeValuation/${id}`, data);
    const payload = unwrap<RawIndicativeValuation>(response.data);

    return {
      ...normalizeIndicativeValuation(payload),
      _responseMessage: getApiSuccessMessage(response.data),
    };
  },

  createIndicativeComponent: async (
    valuationId: number,
    data: CreateIndicativeComponentInput,
  ): Promise<ApiResponseWithMessage<IndicativeValuationComponent>> => {
    const response = await api.post(
      `/property-indicativeValuation/${valuationId}/components`,
      data,
    );
    const payload = unwrap<Partial<IndicativeValuationComponent>>(response.data);

    return {
      ...normalizeComponent(payload),
      _responseMessage: getApiSuccessMessage(response.data),
    };
  },

  updateIndicativeComponent: async (
    valuationId: number,
    componentId: number,
    data: UpdateIndicativeComponentInput,
  ): Promise<ApiResponseWithMessage<IndicativeValuationComponent>> => {
    const response = await api.patch(
      `/property-indicativeValuation/${valuationId}/components/${componentId}`,
      data,
    );
    const payload = unwrap<Partial<IndicativeValuationComponent>>(response.data);

    return {
      ...normalizeComponent(payload),
      _responseMessage: getApiSuccessMessage(response.data),
    };
  },

  deleteIndicativeComponent: async (
    valuationId: number,
    componentId: number,
  ): Promise<{ _responseMessage?: string }> => {
    const response = await api.delete(
      `/property-indicativeValuation/${valuationId}/components/${componentId}`,
    );

    return {
      _responseMessage: getApiSuccessMessage(response.data),
    };
  },

  exportIndicativeValuationsExcel: async (filters?: Record<string, unknown>) => {
    const queryString = buildExportQueryString(filters);
    const url = queryString
      ? `/property-indicativeValuation/export/excel?${queryString}`
      : "/property-indicativeValuation/export/excel";

    const response = await api.get(url, { responseType: "blob" });
    const contentDisposition = response.headers["content-disposition"] as
      | string
      | undefined;

    return {
      blob: response.data as Blob,
      fileName: getFileNameFromContentDisposition(
        contentDisposition,
        "indicative-valuations-export.xlsx",
      ),
    };
  },

  exportIndicativeValuationExcel: async (id: number, filters?: Record<string, unknown>) => {
    const queryString = buildExportQueryString(filters);
    const url = queryString
      ? `/property-indicativeValuation/${id}/export/excel?${queryString}`
      : `/property-indicativeValuation/${id}/export/excel`;

    const response = await api.get(url, { responseType: "blob" });
    const contentDisposition = response.headers["content-disposition"] as
      | string
      | undefined;

    return {
      blob: response.data as Blob,
      fileName: getFileNameFromContentDisposition(contentDisposition),
    };
  },

  exportIndicativeValuationPdf: async (
    id: number,
    options?: { refresh?: boolean },
  ): Promise<ApiResponseWithMessage<IndicativePdfDocument>> => {
    const query = new URLSearchParams();
    if (options?.refresh !== undefined) {
      query.set("refresh", String(options.refresh));
    }

    const url = query.toString()
      ? `/property-indicativeValuation/${id}/export/pdf?${query.toString()}`
      : `/property-indicativeValuation/${id}/export/pdf`;

    const response = await api.get(url);
    const payload = unwrap<IndicativePdfDocument>(response.data);

    return {
      ...payload,
      _responseMessage: getApiSuccessMessage(response.data),
    };
  },

  submitForReview: async (
    id: number,
  ): Promise<ApiResponseWithMessage<IndicativeValuation>> => {
    const response = await api.post(`/property-indicativeValuation/${id}/submit`, {});
    const payload = unwrap<RawIndicativeValuation>(response.data);

    return {
      ...normalizeIndicativeValuation(payload),
      _responseMessage: getApiSuccessMessage(response.data),
    };
  },

  approveValuation: async (
    id: number,
    data: ApproveIndicativeValuationInput,
  ): Promise<ApiResponseWithMessage<IndicativeValuation>> => {
    const response = await api.patch(`/property-indicativeValuation/${id}/approve`, data);
    const payload = unwrap<RawIndicativeValuation>(response.data);

    return {
      ...normalizeIndicativeValuation(payload),
      _responseMessage: getApiSuccessMessage(response.data),
    };
  },

  rejectValuation: async (
    id: number,
    data: RejectIndicativeValuationInput,
  ): Promise<ApiResponseWithMessage<IndicativeValuation>> => {
    const response = await api.patch(`/property-indicativeValuation/${id}/reject`, data);
    const payload = unwrap<RawIndicativeValuation>(response.data);

    return {
      ...normalizeIndicativeValuation(payload),
      _responseMessage: getApiSuccessMessage(response.data),
    };
  },

  reassignIndicativeValuation: async (
    id: number,
    data: ReassignIndicativeValuationInput,
  ): Promise<ApiResponseWithMessage<IndicativeValuation>> => {
    const response = await api.patch(`/property-indicativeValuation/${id}/reassign`, data);
    const payload = unwrap<RawIndicativeValuation>(response.data);

    return {
      ...normalizeIndicativeValuation(payload),
      _responseMessage: getApiSuccessMessage(response.data),
    };
  },

  archiveIndicativeValuation: async (id: number): Promise<{ message?: string }> => {
    const response = await api.delete(`/property-indicativeValuation/${id}`);

    return {
      message: getApiSuccessMessage(response.data),
    };
  },
};
