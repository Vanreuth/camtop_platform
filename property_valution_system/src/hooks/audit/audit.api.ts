import api from "@/lib/api";
import type {
  AuditLog,
  AuditLogResult,
  AuditSummary,
  AuditSummaryResult,
  CreateAuditLogInput,
  PaginationMeta,
  PaginationOptions,
  SearchFilters,
} from "@/hooks/audit/audit.types";
import { unwrap } from "@/utils/helpers";

type SummaryParams = {
  userId?: number;
  days?: number;
};

type CleanupAuditLogsInput = {
  period?: string;
  days?: number;
  beforeDate?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cleanParams = (params: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const extractMessage = (body: unknown): string | undefined => {
  if (!isRecord(body)) return undefined;
  if (typeof body.message === "string") return body.message;
  const data = body.data;
  if (isRecord(data) && typeof data.message === "string") return data.message;
  return undefined;
};

const extractPagination = (
  body: unknown,
  requested: PaginationOptions
): PaginationMeta => {
  const fallback: PaginationMeta = {
    page: requested.page ?? 1,
    limit: requested.limit ?? 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  if (!isRecord(body)) return fallback;

  let source: Record<string, unknown> | null = null;

  if (isRecord(body.pagination)) {
    source = body.pagination;
  } else if (isRecord(body.data) && isRecord(body.data.pagination)) {
    source = body.data.pagination;
  }

  if (!source) return fallback;

  const page = toNumber(source.page, fallback.page);
  const limit = toNumber(source.limit, fallback.limit);
  const total = toNumber(source.total, fallback.total);
  const totalPages = toNumber(
    source.totalPages,
    limit > 0 ? Math.max(1, Math.ceil(total / limit)) : fallback.totalPages
  );
  const hasNextPage =
    typeof source.hasNextPage === "boolean" ? source.hasNextPage : page < totalPages;
  const hasPreviousPage =
    typeof source.hasPreviousPage === "boolean" ? source.hasPreviousPage : page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage,
    hasPreviousPage,
  };
};

const extractLogs = (payload: unknown): AuditLog[] => {
  if (Array.isArray(payload)) return payload as AuditLog[];
  if (isRecord(payload) && Array.isArray(payload.logs)) return payload.logs as AuditLog[];
  return [];
};

const extractStatusCode = (error: unknown): number | undefined => {
  const maybeError = error as {
    status?: number;
    response?: { status?: number };
  };
  return maybeError?.response?.status ?? maybeError?.status;
};

const shouldTryLegacyRoute = (status?: number) =>
  status === 404 || status === 405 || status === 501;

const CLEANUP_PERIOD_ALIASES: Record<string, "7d" | "15d" | "1m" | "3m" | "6m" | "1y"> = {
  "7d": "7d",
  "7day": "7d",
  "7days": "7d",
  "15d": "15d",
  "15day": "15d",
  "15days": "15d",
  "1m": "1m",
  "1month": "1m",
  "3m": "3m",
  "3months": "3m",
  "6m": "6m",
  "6months": "6m",
  "12m": "1y",
  "1y": "1y",
  "1year": "1y",
};

const normalizeCleanupPeriod = (period?: string) => {
  if (!period) return undefined;
  const normalized = period.trim().toLowerCase();
  return CLEANUP_PERIOD_ALIASES[normalized];
};

const toCleanupParams = (input: CleanupAuditLogsInput | string) => {
  if (typeof input === "string") {
    const normalizedPeriod = normalizeCleanupPeriod(input);
    if (normalizedPeriod) return { period: normalizedPeriod };
    return { beforeDate: input };
  }

  const normalizedPeriod = normalizeCleanupPeriod(input.period);
  if (normalizedPeriod) return { period: normalizedPeriod };

  if (typeof input.days === "number" && Number.isFinite(input.days)) {
    return { days: Math.max(1, Math.floor(input.days)) };
  }

  if (typeof input.beforeDate === "string" && input.beforeDate.trim().length > 0) {
    return { beforeDate: input.beforeDate };
  }

  return { period: "3m" as const };
};

export const auditApi = {
  getAuditLogs: async (
    filters: SearchFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<AuditLogResult> => {
    const params = cleanParams({ ...filters, ...pagination });
    const response = await api.get("/audit/logs", { params });

    const payload = unwrap<unknown>(response.data);
    return {
      logs: extractLogs(payload),
      pagination: extractPagination(response.data, pagination),
      message: extractMessage(response.data),
    };
  },

  getUserAuditLogs: async (
    userId: number,
    filters: SearchFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<AuditLogResult> => {
    try {
      const params = cleanParams({ ...filters, ...pagination });
      const response = await api.get(`/users/${userId}/audit-logs`, { params });
      const payload = unwrap<unknown>(response.data);

      return {
        logs: extractLogs(payload),
        pagination: extractPagination(response.data, pagination),
        message: extractMessage(response.data),
      };
    } catch (error) {
      if (!shouldTryLegacyRoute(extractStatusCode(error))) throw error;
      // Backward compatibility: older API expects userId as query param.
      try {
        const params = cleanParams({ ...pagination });
        const response = await api.get(`/audit/logs/${userId}`, { params });
        const payload = unwrap<unknown>(response.data);

        return {
          logs: extractLogs(payload),
          pagination: extractPagination(response.data, pagination),
          message: extractMessage(response.data),
        };
      } catch (legacyError) {
        if (!shouldTryLegacyRoute(extractStatusCode(legacyError))) throw legacyError;
        return auditApi.getAuditLogs({ ...filters, userId }, pagination);
      }
    }
  },

  getAuditLogById: async (id: number): Promise<AuditLog> => {
    const response = await api.get(`/audit/logs/${id}`);
    const payload = unwrap<unknown>(response.data);
    return payload as AuditLog;
  },

  getAuditSummary: async (params?: SummaryParams): Promise<AuditSummaryResult> => {
    const response = await api.get("/audit/summary", {
      params: cleanParams({ ...(params ?? {}) }),
    });

    const payload = unwrap<unknown>(response.data);
    const summary =
      isRecord(payload) && isRecord(payload.summary)
        ? (payload.summary as unknown as AuditSummary)
        : (payload as unknown as AuditSummary);

    return {
      summary,
      message: extractMessage(response.data),
    };
  },

  logAction: async (input: CreateAuditLogInput): Promise<{ message?: string }> => {
    const response = await (async () => {
      try {
        return await api.post("/audit/logs", input);
      } catch (error) {
        if (!shouldTryLegacyRoute(extractStatusCode(error))) throw error;
        return api.post("/audit/log", input);
      }
    })();
    return {
      message: extractMessage(response.data),
    };
  },

  logLoginSession: async (): Promise<{ message?: string }> => {
    const response = await (async () => {
      try {
        return await api.post("/audit/logs/login-session");
      } catch (error) {
        if (!shouldTryLegacyRoute(extractStatusCode(error))) throw error;
        return api.post("/audit/login");
      }
    })();
    return {
      message: extractMessage(response.data),
    };
  },

  cleanupAuditLogs: async (
    input: CleanupAuditLogsInput | string
  ): Promise<{ message?: string }> => {
    const params = cleanParams(toCleanupParams(input));
    const response = await (async () => {
      try {
        return await api.delete("/audit/logs/cleanup", {
          params,
        });
      } catch (error) {
        if (!shouldTryLegacyRoute(extractStatusCode(error))) throw error;
        return api.delete("/audit/cleanup", {
          params,
        });
      }
    })();
    return {
      message: extractMessage(response.data),
    };
  },
};
