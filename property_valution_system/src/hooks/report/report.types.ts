import type { Pagination } from "@/utils/helpers";

export type GeneratedReportType =
  | "PROPERTY_LISTING"
  | "VALUATION"
  | "AUDIT_LOG"
  | "USER_ACTIVITY";

export type ReportTarget =
  | "USER"
  | "PROPERTY"
  | "PROPERTY_VALUATION"
  | "INDICATIVE_VALUATION";

export type ReportFormat = "XLSX" | "PDF";

export type SupportedReportTarget = ReportTarget;
export type SupportedReportFormat = ReportFormat;

export interface GeneratedReportUser {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface GeneratedReport {
  reportId: number;
  reportName: string;
  reportType: GeneratedReportType;
  reportTarget: ReportTarget;
  format: ReportFormat;
  fileUrl: string;
  description?: string | null;
  summary?: string | null;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  generatedByUserId: number;
  userId?: number | null;
  generatedByUser?: GeneratedReportUser | null;
}

export interface ReportListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  reportTarget?: ReportTarget;
  format?: ReportFormat;
  reportType?: GeneratedReportType;
  generatedByMe?: boolean;
}

export interface ReportListSummary {
  totalReports: number;
  myReports: number;
  latestGeneratedAt?: string | null;
}

export interface ReportListResult {
  reports: GeneratedReport[];
  pagination: Pagination;
  summary?: ReportListSummary;
  message?: string;
}

export interface GenerateReportInput {
  reportTarget: SupportedReportTarget;
  format: SupportedReportFormat;
  reportName?: string;
  description?: string;
  filters?: Record<string, unknown>;
}

export interface GenerateReportResult {
  report: GeneratedReport;
  downloadUrl: string;
  _responseMessage?: string;
}

export interface DownloadReportResult {
  report: GeneratedReport;
  downloadUrl: string;
  _responseMessage?: string;
}
