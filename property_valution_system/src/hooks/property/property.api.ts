import api from "@/lib/api";
import { unwrapPage, unwrap, Pagination, getApiSuccessMessage } from "@/utils/helpers";
import type {
  ApiParams,
  Property,
  PropertySearchCircleParams,
  PropertySearchPolygonParams,
  PropertyAnalysis,
  NearbyAmenityItem,
  NearbyProperty,
  PropertyStatisticsFilters,
} from "@/types/property.types";


export type PropertyListResult = {
  properties: Property[];
  pagination: Pagination;
  message?: string;
};

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

type PropertyPayload = Property | { property: Property };

const coerceDate = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const buildQueryString = (params: ApiParams): string => {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== "" && v !== "All"
    )
  );

  return new URLSearchParams(
    Object.entries(cleaned).map(([key, value]) => [key, String(value)])
  ).toString();
};

const createFallbackPagination = (params: ApiParams): Pagination => {
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

const normalizeProperty = (payload: PropertyPayload): Property => {
  const property = "property" in payload ? payload.property : payload;
  return {
    ...property,
    id: property.id ?? property.propertyId,
  };
};

const toFiniteNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeAmenityItem = (item: unknown): NearbyAmenityItem => {
  const amenity = (item as Record<string, unknown>) ?? {};
  return {
    name: typeof amenity.name === "string" ? amenity.name : "Unknown",
    distance: toFiniteNumber(amenity.distance),
    rating: toFiniteNumber(amenity.rating),
    address: typeof amenity.address === "string" ? amenity.address : undefined,
    lat: toFiniteNumber(amenity.lat),
    lng: toFiniteNumber(amenity.lng),
    priceLevel: toFiniteNumber(amenity.priceLevel),
  };
};

const normalizeNearbyProperty = (item: unknown): NearbyProperty => {
  const property = (item as Record<string, unknown>) ?? {};

  return {
    id: toFiniteNumber(property.id) ?? 0,
    name: typeof property.name === "string" ? property.name : undefined,
    code: typeof property.code === "string" ? property.code : undefined,
    type: typeof property.type === "string" ? property.type : undefined,
    distance: toFiniteNumber(property.distance),
    price: toFiniteNumber(property.price),
    status: typeof property.status === "string" ? property.status : undefined,
    location:
      property.location && typeof property.location === "object"
        ? {
            latitude: toFiniteNumber(
              (property.location as Record<string, unknown>).latitude
            ),
            longitude: toFiniteNumber(
              (property.location as Record<string, unknown>).longitude
            ),
          }
        : undefined,
  };
};

const normalizePropertyAnalysis = (payload: unknown): PropertyAnalysis => {
  const source =
    payload && typeof payload === "object" && "analysis" in (payload as object)
      ? ((payload as { analysis?: unknown }).analysis ?? {})
      : (payload ?? {});

  const analysis = source as Record<string, unknown>;
  const amenities = (analysis.nearbyAmenities ?? {}) as Record<string, unknown>;
  const summary = (analysis.summary ?? {}) as Record<string, unknown>;
  const nearbyPropertiesRaw = Array.isArray(analysis.nearbyProperties)
    ? analysis.nearbyProperties
    : [];

  const normalizeAmenityList = (value: unknown): NearbyAmenityItem[] =>
    Array.isArray(value) ? value.map(normalizeAmenityItem) : [];

  return {
    property:
      analysis.property && typeof analysis.property === "object"
        ? (analysis.property as PropertyAnalysis["property"])
        : undefined,
    nearbyAmenities: {
      schools: normalizeAmenityList(amenities.schools),
      hospitals: normalizeAmenityList(amenities.hospitals),
      restaurants: normalizeAmenityList(amenities.restaurants),
      banks: normalizeAmenityList(amenities.banks),
      supermarkets: normalizeAmenityList(amenities.supermarkets),
    },
    nearbyProperties: nearbyPropertiesRaw.map(normalizeNearbyProperty),
    summary: {
      totalNearbySchools: toFiniteNumber(summary.totalNearbySchools) ?? 0,
      totalNearbyHospitals: toFiniteNumber(summary.totalNearbyHospitals) ?? 0,
      totalNearbyRestaurants: toFiniteNumber(summary.totalNearbyRestaurants) ?? 0,
      totalNearbyBanks: toFiniteNumber(summary.totalNearbyBanks) ?? 0,
      totalNearbySupermarkets:
        toFiniteNumber(summary.totalNearbySupermarkets) ?? 0,
      totalNearbyProperties: toFiniteNumber(summary.totalNearbyProperties) ?? 0,
      locationScore: toFiniteNumber(summary.locationScore) ?? 0,
      locationRating:
        typeof summary.locationRating === "string"
          ? summary.locationRating
          : "N/A",
    },
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

    query.append(key, String(coerceDate(value)));
  });
  return query.toString();
};

const getFileNameFromContentDisposition = (
  contentDisposition?: string,
  fallback = "properties-export.xlsx"
) => {
  if (!contentDisposition) return fallback;
  const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(contentDisposition);
  if (!match?.[1]) return fallback;
  return decodeURIComponent(match[1]).replace(/"/g, "");
};

export const propertyApi = {
  getProperties: async (
    params: ApiParams = {
      page: 0,
      limit: 0,
    }
  ): Promise<PropertyListResult> => {
    const queryString = buildQueryString(params);
    const url = queryString ? `/properties?${queryString}` : "/properties";

    const response = await api.get(url);
    const { data: responseData, pagination, message } =
      unwrapPage<{ properties: Property[] }>(response.data);
    const properties = (responseData?.properties ?? []).map((property) =>
      normalizeProperty(property)
    );

    return {
      properties,
      pagination: pagination || createFallbackPagination(params),
      message,
    };
  },

  getPropertyStatistics: async (
    filters?: PropertyStatisticsFilters
  ): Promise<any> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.propertyTypeId) params.append("propertyTypeId", String(filters.propertyTypeId));
    if (filters?.provinceId) params.append("provinceId", String(filters.provinceId));
    if (filters?.status) params.append("status", filters.status);
    
    const queryString = params.toString();
    const url = queryString ? `/properties/statistics?${queryString}` : "/properties/statistics";
    const response = await api.get(url);
    return unwrap(response.data);
    

  },

  getPropertyById: async (id: number): Promise<ApiResponseWithMessage<Property>> => {
    const response = await api.get(`/properties/${id}`);
    const payload = unwrap<PropertyPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeProperty(payload),
      _responseMessage: message,
    };
  },

  getPropertiesLocation: async (params?: Record<string, string>) => {
    const queryString = params
      ? `?${new URLSearchParams(params).toString()}`
      : "";
    const response = await api.get(`/properties/map/locations${queryString}`);
    return unwrap(response.data);
  },

  getPropertyLocationAnalysis: async (id: number): Promise<PropertyAnalysis> => {
    const response = await api.get(`/properties/${id}/nearby`);
    const payload = unwrap<unknown>(response.data);
    return normalizePropertyAnalysis(payload);
  },

  createProperty: async (
    data: FormData
  ): Promise<ApiResponseWithMessage<Property>> => {
    const response = await api.post("/properties", data);
    const payload = unwrap<PropertyPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeProperty(payload),
      _responseMessage: message,
    };
  },

  updateProperty: async (
    id: number,
    data: FormData
  ): Promise<ApiResponseWithMessage<Property>> => {
    const response = await api.put(`/properties/${id}`, data);
    const payload = unwrap<PropertyPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeProperty(payload),
      _responseMessage: message,
    };
  },

  updatePropertyLocation: async (
    id: number,
    mapData: {
      point?: { latitude: number; longitude: number };
      polygon?: Array<{ latitude: number; longitude: number }>;
    }
  ): Promise<
    ApiResponseWithMessage<
      Record<string, unknown> | { data: unknown }
    >
  > => {
    const response = await api.put(`/properties/${id}/location`, { mapData });
    const data = unwrap<unknown>(response.data);
    const message = getApiSuccessMessage(response.data);

    if (typeof data === "object" && data !== null) {
      return {
        ...(data as Record<string, unknown>),
        _responseMessage: message,
      };
    }

    return { data, _responseMessage: message };
  },

  deleteProperty: async (id: number): Promise<{ message?: string }> => {
    const response = await api.delete(`/properties/${id}`);
    const message = getApiSuccessMessage(response.data);
    return { message };
  },

  deletePropertyTransaction: async (
    transactionId: number
  ): Promise<{ message?: string }> => {
    const response = await api.delete(`/properties/transactions/${transactionId}`);
    const message = getApiSuccessMessage(response.data);
    return { message };
  },

  searchPropertiesByCircle: async (params: PropertySearchCircleParams) => {
    const response = await api.post("/properties/search/circle", params);
    return unwrap(response.data);
  },

  searchPropertiesByPolygon: async (params: PropertySearchPolygonParams) => {
    const response = await api.post("/properties/search/polygon", params);
    return unwrap(response.data);
  },

  exportPropertiesExcel: async (filters?: Record<string, unknown>) => {
    const queryString = buildExportQueryString(filters);
    const url = queryString
      ? `/properties/export/excel?${queryString}`
      : "/properties/export/excel";

    const response = await api.get(url, { responseType: "blob" });
    const contentDisposition = response.headers["content-disposition"] as
      | string
      | undefined;

    return {
      blob: response.data as Blob,
      fileName: getFileNameFromContentDisposition(contentDisposition),
    };
  },

  importPropertiesExcel: async (
    file: File
  ): Promise<{ summary?: ImportSummary; _responseMessage?: string }> => {
    const formData = new FormData();
    formData.append("excelFile", file);

    const response = await api.post("/properties/import/excel", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const data = unwrap<{ summary?: ImportSummary }>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...data,
      _responseMessage: message,
    };
  },

  /**
   * =====================================================
   * PROPERTY APPROVAL WORKFLOW
   * =====================================================
   */

  submitForReview: async (
    id: number
  ): Promise<ApiResponseWithMessage<Property>> => {
    const response = await api.post(`/properties/${id}/submit`, {});
    const payload = unwrap<PropertyPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeProperty(payload),
      _responseMessage: message,
    };
  },

  approveProperty: async (
    id: number,
    data: { notes?: string }
  ): Promise<ApiResponseWithMessage<Property>> => {
    const response = await api.post(`/properties/${id}/approve`, data);
    const payload = unwrap<PropertyPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeProperty(payload),
      _responseMessage: message,
    };
  },

  rejectProperty: async (
    id: number,
    data: { reason: string }
  ): Promise<ApiResponseWithMessage<Property>> => {
    const response = await api.post(`/properties/${id}/reject`, data);
    const payload = unwrap<PropertyPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeProperty(payload),
      _responseMessage: message,
    };
  },

  archiveProperty: async (
    id: number
  ): Promise<ApiResponseWithMessage<Property>> => {
    const response = await api.post(`/properties/${id}/archive`, {});
    const payload = unwrap<PropertyPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeProperty(payload),
      _responseMessage: message,
    };
  },

  restoreProperty: async (
    id: number
  ): Promise<ApiResponseWithMessage<Property>> => {
    const response = await api.post(`/properties/${id}/restore`, {});
    const payload = unwrap<PropertyPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeProperty(payload),
      _responseMessage: message,
    };
  },

  reassignProperty: async (
    id: number,
    data: { newCreatorId: number }
  ): Promise<ApiResponseWithMessage<Property>> => {
    const response = await api.post(`/properties/${id}/reassign`, data);
    const payload = unwrap<PropertyPayload>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...normalizeProperty(payload),
      _responseMessage: message,
    };
  },
};
