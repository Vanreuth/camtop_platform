import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { auditApi } from "@/hooks/audit/audit.api";
import type {
  AuditLogResult,
  AuditSummaryResult,
  CreateAuditLogInput,
  PaginationOptions,
  SearchFilters,
} from "@/hooks/audit/audit.types";
import { getApiErrorMessage } from "@/utils/helpers";

export const auditKeys = {
  all: ["audit"] as const,
  logs: () => [...auditKeys.all, "logs"] as const,
  logList: (filters?: SearchFilters, pagination?: PaginationOptions) =>
    [...auditKeys.logs(), filters, pagination] as const,
  userLogs: (
    userId?: number,
    filters?: SearchFilters,
    pagination?: PaginationOptions
  ) => [...auditKeys.logs(), "user", userId, filters, pagination] as const,
  summary: (params?: { userId?: number; days?: number }) =>
    [...auditKeys.all, "summary", params] as const,
};

export function useAuditLogs(
  filters: SearchFilters = {},
  pagination: PaginationOptions = {},
  enabled = true
) {
  return useQuery<AuditLogResult>({
    queryKey: auditKeys.logList(filters, pagination),
    queryFn: () => auditApi.getAuditLogs(filters, pagination),
    enabled,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useUserAuditLogs(
  userId?: number,
  filters: SearchFilters = {},
  pagination: PaginationOptions = {},
  enabled = true
) {
  return useQuery<AuditLogResult>({
    queryKey: auditKeys.userLogs(userId, filters, pagination),
    queryFn: () => {
      if (!userId) {
        throw new Error("userId is required");
      }
      return auditApi.getUserAuditLogs(userId, filters, pagination);
    },
    enabled: enabled && !!userId,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useAuditSummary(
  params?: {
    userId?: number;
    days?: number;
  },
  enabled = true
) {
  return useQuery<AuditSummaryResult>({
    queryKey: auditKeys.summary(params),
    queryFn: () => auditApi.getAuditSummary(params),
    enabled,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useLogAuditAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAuditLogInput) => auditApi.logAction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auditKeys.all });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to log audit action"));
    },
  });
}

export function useLogLoginSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => auditApi.logLoginSession(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: auditKeys.all });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to log login session"));
    },
  });
}
