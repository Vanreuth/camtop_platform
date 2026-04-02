import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiErrorDescription, getApiErrorMessage } from "@/utils/helpers";
import { indicativeValuationApi } from "./indicativeValuation.api";
import type {
  ApproveIndicativeValuationInput,
  CreateIndicativeValuationInput,
  IndicativeValuationQueryParams,
  ReassignIndicativeValuationInput,
  RejectIndicativeValuationInput,
  UpdateIndicativeValuationInput,
} from "./indicativeValuation.types";

export const indicativeValuationKeys = {
  all: ["indicative-valuations"] as const,
  lists: () => [...indicativeValuationKeys.all, "list"] as const,
  list: (params?: IndicativeValuationQueryParams) =>
    [...indicativeValuationKeys.lists(), params] as const,
  details: () => [...indicativeValuationKeys.all, "detail"] as const,
  detail: (id: number) => [...indicativeValuationKeys.details(), id] as const,
};

export function useIndicativeValuations(
  params: IndicativeValuationQueryParams = {},
) {
  return useQuery({
    queryKey: indicativeValuationKeys.list(params),
    queryFn: () => indicativeValuationApi.getIndicativeValuations(params),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}

export function useIndicativeValuation(id: number, enabled = true) {
  return useQuery({
    queryKey: indicativeValuationKeys.detail(id),
    queryFn: () => indicativeValuationApi.getIndicativeValuationById(id),
    enabled: enabled && !!id,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCreateIndicativeValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateIndicativeValuationInput | FormData) =>
      indicativeValuationApi.createIndicativeValuation(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: indicativeValuationKeys.lists() });

      const message =
        response?._responseMessage || "Indicative valuation created successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to create indicative valuation"),
        {
          description: getApiErrorDescription(error),
        },
      );
    },
  });
}

export function useUpdateIndicativeValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateIndicativeValuationInput }) =>
      indicativeValuationApi.updateIndicativeValuation(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: indicativeValuationKeys.lists() });
      queryClient.setQueryData(indicativeValuationKeys.detail(variables.id), response);

      const message =
        response?._responseMessage || "Indicative valuation updated successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to update indicative valuation"),
        {
          description: getApiErrorDescription(error),
        },
      );
    },
  });
}

export function useExportIndicativeValuationExcel() {
  return useMutation({
    mutationFn: ({ id, filters }: { id: number; filters?: Record<string, unknown> }) =>
      indicativeValuationApi.exportIndicativeValuationExcel(id, filters),
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to export indicative valuation report"),
        {
          description: getApiErrorDescription(error),
        },
      );
    },
  });
}

export function useExportIndicativeValuationsExcel() {
  return useMutation({
    mutationFn: (filters?: Record<string, unknown>) =>
      indicativeValuationApi.exportIndicativeValuationsExcel(filters),
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to export indicative valuations"),
        {
          description: getApiErrorDescription(error),
        },
      );
    },
  });
}

export function useExportIndicativeValuationPdf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, refresh }: { id: number; refresh?: boolean }) =>
      indicativeValuationApi.exportIndicativeValuationPdf(id, { refresh }),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: indicativeValuationKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: indicativeValuationKeys.lists() });
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to export indicative valuation PDF"),
        {
          description: getApiErrorDescription(error),
        },
      );
    },
  });
}

export function useSubmitIndicativeValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => indicativeValuationApi.submitForReview(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: indicativeValuationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: indicativeValuationKeys.detail(id) });

      const message =
        response?._responseMessage || "Indicative valuation submitted for review";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to submit indicative valuation"),
        {
          description: getApiErrorDescription(error),
        },
      );
    },
  });
}

export function useApproveIndicativeValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ApproveIndicativeValuationInput }) =>
      indicativeValuationApi.approveValuation(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: indicativeValuationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: indicativeValuationKeys.detail(variables.id),
      });

      const message =
        response?._responseMessage || "Indicative valuation approved successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to approve indicative valuation"),
        {
          description: getApiErrorDescription(error),
        },
      );
    },
  });
}

export function useRejectIndicativeValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RejectIndicativeValuationInput }) =>
      indicativeValuationApi.rejectValuation(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: indicativeValuationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: indicativeValuationKeys.detail(variables.id),
      });

      const message = response?._responseMessage || "Indicative valuation rejected";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to reject indicative valuation"),
        {
          description: getApiErrorDescription(error),
        },
      );
    },
  });
}

export function useReassignIndicativeValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: ReassignIndicativeValuationInput;
    }) => indicativeValuationApi.reassignIndicativeValuation(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: indicativeValuationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: indicativeValuationKeys.detail(variables.id),
      });

      const message =
        response?._responseMessage || "Indicative valuation reassigned successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to reassign indicative valuation"),
        {
          description: getApiErrorDescription(error),
        },
      );
    },
  });
}

export function useArchiveIndicativeValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => indicativeValuationApi.archiveIndicativeValuation(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: indicativeValuationKeys.lists() });
      queryClient.removeQueries({ queryKey: indicativeValuationKeys.detail(id) });

      const message = response?.message || "Indicative valuation archived successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to archive indicative valuation"),
        {
          description: getApiErrorDescription(error),
        },
      );
    },
  });
}
