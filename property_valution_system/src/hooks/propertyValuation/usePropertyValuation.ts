import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { propertyValuationApi } from "./propertyValuation.api";
import type {
  ApproveValuationInput,
  CreatePropertyValuationInput,
  PropertyValuationQueryParams,
  ReassignValuationInput,
  RejectValuationInput,
  UpdatePropertyValuationInput,
  ValuationStatisticsFilters
} from "./propertyValuation.types";
import { getApiErrorMessage, getApiSuccessMessage } from "@/utils/helpers";
import type { ImportSummary } from "./propertyValuation.api";

export const propertyValuationKeys = {
  all: ["property-valuations"] as const,
  lists: () => [...propertyValuationKeys.all, "list"] as const,
  list: (params?: PropertyValuationQueryParams) =>
    [...propertyValuationKeys.lists(), params] as const,
  details: () => [...propertyValuationKeys.all, "detail"] as const,
  detail: (id: number) => [...propertyValuationKeys.details(), id] as const,
  statistics: () => [...propertyValuationKeys.all, "statistics"] as const,
  stats: (filters?: Record<string, unknown>) =>
    [...propertyValuationKeys.statistics(), filters] as const,
};

export function usePropertyValuations(params: PropertyValuationQueryParams = {}) {
  console.log("PropertyValuations params:", params);
  return useQuery({
    queryKey: propertyValuationKeys.list(params),
    queryFn: () => propertyValuationApi.getPropertyValuations(params),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

}

export function usePropertyValuation(id: number, enabled = true) {
  return useQuery({
    queryKey: propertyValuationKeys.detail(id),
    queryFn: () => propertyValuationApi.getPropertyValuationById(id),
    enabled: enabled && !!id,
    staleTime: 60_000,
  });
}

export function usePropertyValuationStatistics(filters?: ValuationStatisticsFilters) {
  return useQuery({
    queryKey: ["propertyValuationStatistics", filters] as const,
    queryFn: () => propertyValuationApi.getValuationStatistics(filters),
    staleTime: 60_000,
  });
}

export function useCreatePropertyValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePropertyValuationInput | FormData) =>
      propertyValuationApi.createPropertyValuation(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: propertyValuationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: propertyValuationKeys.statistics(),
      });

      const message =
        response?._responseMessage || "Property valuation created successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to create property valuation")
      );
    },
  });
}

export function useUpdatePropertyValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdatePropertyValuationInput | FormData;
    }) => propertyValuationApi.updatePropertyValuation(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyValuationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: propertyValuationKeys.statistics(),
      });
      queryClient.setQueryData(
        propertyValuationKeys.detail(variables.id),
        response
      );

      const message =
        response?._responseMessage || "Property valuation updated successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to update property valuation")
      );
    },
  });
}

export function useSubmitPropertyValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => propertyValuationApi.submitForReview(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: propertyValuationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: propertyValuationKeys.statistics(),
      });

      const message =
        response?._responseMessage ||
        "Property valuation submitted for review successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to submit valuation for review")
      );
    },
  });
}

export function useApprovePropertyValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: ApproveValuationInput;
    }) => propertyValuationApi.approveValuation(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyValuationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: propertyValuationKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: propertyValuationKeys.statistics(),
      });

      const message =
        response?._responseMessage ||
        "Property valuation approved successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to approve property valuation")
      );
    },
  });
}

export function useRejectPropertyValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: RejectValuationInput;
    }) => propertyValuationApi.rejectValuation(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyValuationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: propertyValuationKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: propertyValuationKeys.statistics(),
      });

      const message =
        response?._responseMessage ||
        "Property valuation rejected successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to reject property valuation")
      );
    },
  });
}

export function useReassignPropertyValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: ReassignValuationInput;
    }) => propertyValuationApi.reassignValuation(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyValuationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: propertyValuationKeys.detail(variables.id),
      });
      // Stats might change if we filter by valuer ID
      queryClient.invalidateQueries({
        queryKey: propertyValuationKeys.statistics(),
      });

      const message =
        response?._responseMessage || "Property valuation reassigned successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to reassign property valuation")
      );
    },
  });
}

export function useDeletePropertyValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => propertyValuationApi.deletePropertyValuation(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: propertyValuationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: propertyValuationKeys.statistics(),
      });
      queryClient.removeQueries({ queryKey: propertyValuationKeys.detail(id) });

      const message =
        response?.message || "Property valuation archived successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to archive property valuation")
      );
    },
  });
}

export function useExportPropertyValuationsExcel() {
  return useMutation({
    mutationFn: (filters?: Record<string, unknown>) =>
      propertyValuationApi.exportPropertyValuationsExcel(filters),
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to export property valuations")
      );
    },
  });
}

export function useImportPropertyValuationsExcel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => propertyValuationApi.importPropertyValuationsExcel(file),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: propertyValuationKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: propertyValuationKeys.statistics(),
      });

      const summary = response?.summary as ImportSummary | undefined;
      const failed = summary?.failed ?? 0;
      const succeeded = (summary?.created ?? 0) + (summary?.updated ?? 0);
      const defaultMsg =
        response?._responseMessage ||
        getApiSuccessMessage(response) ||
        "Property valuation Excel imported successfully";

      if (failed === 0) {
        toast.success(defaultMsg);
      } else if (succeeded > 0) {
        // Partial: some rows OK, some failed
        const rowErrors = summary?.errors
          ?.slice(0, 5)
          .map((e) => `Row ${e.row}: ${e.message}`)
          .join("\n");
        toast.warning(defaultMsg, {
          description: rowErrors || undefined,
        });
      } else {
        // All rows failed
        const rowErrors = summary?.errors
          ?.slice(0, 5)
          .map((e) => `Row ${e.row}: ${e.message}`)
          .join("\n");
        toast.error(
          `Import failed: all ${failed} row${failed !== 1 ? "s" : ""} had errors`,
          { description: rowErrors || "Check that required fields and enum values are correct." },
        );
      }
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Failed to import property valuations")
      );
    },
  });
}

export function useValuationStatistics(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: propertyValuationKeys.stats(filters),
    queryFn: () => propertyValuationApi.getValuationStatistics(filters),
    staleTime: 60_000,
  });
}

export function useDownloadValuationDocument() {
  return useMutation({
    mutationFn: (id: number) => propertyValuationApi.downloadValuationDocument(id),
  });
}
