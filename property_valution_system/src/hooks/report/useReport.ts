import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorDescription, getApiErrorMessage } from "@/utils/helpers";
import { reportApi } from "./report.api";
import type { GenerateReportInput, ReportListQueryParams } from "./report.types";

export const reportKeys = {
  all: ["reports"] as const,
  lists: () => [...reportKeys.all, "list"] as const,
  list: (params?: ReportListQueryParams) => [...reportKeys.lists(), params] as const,
};

export function useReports(params: ReportListQueryParams = { page: 1, limit: 10 }) {
  return useQuery({
    queryKey: reportKeys.list(params),
    queryFn: () => reportApi.getReports(params),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: GenerateReportInput) => reportApi.generateReport(payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: reportKeys.lists() });
      toast.success(response?._responseMessage || "Report generated successfully");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to generate report"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}

export function useDownloadReport() {
  return useMutation({
    mutationFn: (reportId: number) => reportApi.downloadReport(reportId),
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to download report"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}
