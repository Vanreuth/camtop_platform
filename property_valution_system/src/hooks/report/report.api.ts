import api from "@/lib/api";
import {
  defaultPagination,
  getApiSuccessMessage,
  unwrap,
  unwrapPage,
  type Pagination,
} from "@/utils/helpers";
import type {
  DownloadReportResult,
  GenerateReportInput,
  GenerateReportResult,
  GeneratedReport,
  ReportFormat,
  GeneratedReportType,
  ReportListSummary,
  ReportTarget,
  ReportListQueryParams,
  ReportListResult,
} from "./report.types";

type RawGeneratedReport = Partial<GeneratedReport> & {
  reportId?: number;
  reportName?: string;
  reportType?: GeneratedReportType;
  reportTarget?: ReportTarget;
  format?: ReportFormat;
};

type ReportPayload = {
  report: RawGeneratedReport;
  downloadUrl: string;
};

const normalizeReport = (payload: RawGeneratedReport): GeneratedReport => ({
  reportId: Number(payload.reportId ?? 0),
  reportName: payload.reportName ?? "",
  reportType: (payload.reportType ?? "PROPERTY_LISTING") as GeneratedReportType,
  reportTarget: (payload.reportTarget ?? "PROPERTY") as ReportTarget,
  format: (payload.format ?? "XLSX") as ReportFormat,
  fileUrl: payload.fileUrl ?? "",
  description: payload.description ?? null,
  summary: payload.summary ?? null,
  generatedAt: payload.generatedAt ?? payload.createdAt ?? new Date().toISOString(),
  createdAt: payload.createdAt ?? payload.generatedAt ?? new Date().toISOString(),
  updatedAt: payload.updatedAt ?? payload.createdAt ?? new Date().toISOString(),
  generatedByUserId: Number(payload.generatedByUserId ?? 0),
  userId: payload.userId ?? null,
  generatedByUser: payload.generatedByUser ?? null,
});

const buildQueryString = (params: ReportListQueryParams) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      value === "All"
    ) {
      return;
    }

    query.set(key, String(value));
  });

  return query.toString();
};

const normalizePagination = (
  pagination: Pagination | undefined,
  params: ReportListQueryParams,
): Pagination => pagination ?? defaultPagination(params.page ?? 1, params.limit ?? 10);

const normalizeSummary = (summary: unknown): ReportListSummary | undefined => {
  if (!summary || typeof summary !== "object") {
    return undefined;
  }

  const value = summary as Partial<ReportListSummary>;

  return {
    totalReports: Number(value.totalReports ?? 0),
    myReports: Number(value.myReports ?? 0),
    latestGeneratedAt: value.latestGeneratedAt ?? null,
  };
};

export const reportApi = {
  getReports: async (
    params: ReportListQueryParams = { page: 1, limit: 10 },
  ): Promise<ReportListResult> => {
    const queryString = buildQueryString(params);
    const url = queryString ? `/reports?${queryString}` : "/reports";

    const response = await api.get(url);
    const { data, pagination, message } = unwrapPage<{
      reports?: RawGeneratedReport[];
      summary?: ReportListSummary;
    }>(
      response.data,
    );

    return {
      reports: Array.isArray(data?.reports) ? data.reports.map(normalizeReport) : [],
      pagination: normalizePagination(pagination, params),
      summary: normalizeSummary(data?.summary),
      message,
    };
  },

  generateReport: async (
    payload: GenerateReportInput,
  ): Promise<GenerateReportResult> => {
    const response = await api.post("/reports/generate", payload);
    const data = unwrap<ReportPayload>(response.data);

    return {
      report: normalizeReport(data.report),
      downloadUrl: data.downloadUrl,
      _responseMessage: getApiSuccessMessage(response.data),
    };
  },

  downloadReport: async (reportId: number): Promise<DownloadReportResult> => {
    const response = await api.get(`/reports/${reportId}/download`);
    const data = unwrap<ReportPayload>(response.data);

    return {
      report: normalizeReport(data.report),
      downloadUrl: data.downloadUrl,
      _responseMessage: getApiSuccessMessage(response.data),
    };
  },
};
