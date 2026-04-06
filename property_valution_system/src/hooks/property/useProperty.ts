import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { propertyApi } from "./property.api";
import type {
  ApiParams,
  PropertySearchCircleParams,
  PropertySearchParams,
  PropertySearchPolygonParams,
  ApprovePropertyInput,
  RejectPropertyInput,
  PropertyStatisticsFilters,
} from "@/types/property.types";
import {
  getApiErrorDescription,
  getApiErrorMessage,
  getApiSuccessMessage,
} from "@/utils/helpers";
import type { ImportSummary } from "./property.api";

export const propertyKeys = {
  all: ["properties"] as const,
  lists: () => [...propertyKeys.all, "list"] as const,
  list: (params?: ApiParams) => [...propertyKeys.lists(), params] as const,
  details: () => [...propertyKeys.all, "detail"] as const,
  detail: (id: number) => [...propertyKeys.details(), id] as const,
  locations: (params?: Record<string, string>) =>
    [...propertyKeys.all, "locations", params] as const,
  nearby: (id: number) => [...propertyKeys.all, "nearby", id] as const,
  search: () => [...propertyKeys.all, "search"] as const,
  searchCircle: (params: PropertySearchCircleParams) =>
    [...propertyKeys.search(), "circle", params] as const,
  searchPolygon: (params: PropertySearchPolygonParams) =>
    [...propertyKeys.search(), "polygon", params] as const,
};

const SEARCH_STALE_TIME = 30_000;

const isValidCircleSearchParams = (params: PropertySearchCircleParams) =>
  Number.isFinite(params.centerLat) && Number.isFinite(params.centerLng);

const hasPolygonCoordinates = (params: PropertySearchPolygonParams) =>
  params.coordinates.length > 0;

const handleSearchError = (error: unknown) => {
  toast.error(getApiErrorMessage(error, "Failed to search properties"));
};

export function useProperties(params: ApiParams = {}) {
  return useQuery({
    queryKey: propertyKeys.list(params),
    queryFn: () => propertyApi.getProperties(params),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    placeholderData: (previousData) => previousData,
  });
}

export function useProperty(id: number, enabled = true) {
  return useQuery({
    queryKey: propertyKeys.detail(id),
    queryFn: () => propertyApi.getPropertyById(id),
    enabled: enabled && !!id,
    staleTime: 60_000,
  });
}

export function usePropertiesLocation(params?: Record<string, string>) {
  return useQuery({
    queryKey: propertyKeys.locations(params),
    queryFn: () => propertyApi.getPropertiesLocation(params),
    staleTime: 60_000,
    // Keep the previous map dataset while new filters are loading
    // so the map component does not unmount (prevents fullscreen exit/flicker).
    placeholderData: (previousData) => previousData,
  });
}

export function useProperiesStatistics(filters?: PropertyStatisticsFilters) {
  return useQuery({
    queryKey: ["propertyStatistics", filters] as const,
    queryFn: () => propertyApi.getPropertyStatistics(filters),
    staleTime: 60_000,
  });
}

export function usePropertyLocationAnalysis(id: number, enabled = true) {
  return useQuery({
    queryKey: propertyKeys.nearby(id),
    queryFn: () => propertyApi.getPropertyLocationAnalysis(id),
    enabled: enabled && !!id,
    staleTime: 300_000,
  });
}


export function useCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FormData) => propertyApi.createProperty(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.locations() });

      const message =
        response?._responseMessage ||
        getApiSuccessMessage(response) ||
        "Property created successfully";
      toast.success(message);
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Failed to create property");
      const description = getApiErrorDescription(error);

      toast.error(message, {
        description,
      });
    },
  });
}

export function useUpdateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) =>
      propertyApi.updateProperty(id, data),
    onSuccess: (updatedProperty, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.locations() });
      queryClient.invalidateQueries({
        queryKey: propertyKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: propertyKeys.nearby(variables.id),
      });

      const message =
        updatedProperty?._responseMessage ||
        getApiSuccessMessage(updatedProperty) ||
        "Property updated successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to update property"));
    },
  });
}

export function useUpdatePropertyLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      mapData,
    }: {
      id: number;
      mapData: {
        point?: { latitude: number; longitude: number };
        polygon?: Array<{ latitude: number; longitude: number }>;
      };
    }) => propertyApi.updatePropertyLocation(id, mapData),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({
        queryKey: propertyKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: propertyKeys.locations() });
      queryClient.invalidateQueries({
        queryKey: propertyKeys.nearby(variables.id),
      });

      const message =
        response?._responseMessage ||
        getApiSuccessMessage(response) ||
        "Property location updated successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to update property location"));
    },
  });
}

export function useDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => propertyApi.deleteProperty(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.locations() });
      queryClient.removeQueries({ queryKey: propertyKeys.detail(id) });
      queryClient.removeQueries({ queryKey: propertyKeys.nearby(id) });

      const message =
        response?.message ||
        getApiSuccessMessage(response) ||
        "Property deleted successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to delete property"));
    },
  });
}

export function useDeletePropertyTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { transactionId: number; propertyId?: number }) =>
      propertyApi.deletePropertyTransaction(variables.transactionId),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      if (variables.propertyId) {
        queryClient.invalidateQueries({
          queryKey: propertyKeys.detail(variables.propertyId),
        });
      }

      const message =
        response?.message ||
        getApiSuccessMessage(response) ||
        "Transaction deleted successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to delete transaction"));
    },
  });
}

export function useExportPropertiesExcel() {
  return useMutation({
    mutationFn: (filters?: Record<string, unknown>) =>
      propertyApi.exportPropertiesExcel(filters),
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to export properties"));
    },
  });
}

export function useImportPropertiesExcel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => propertyApi.importPropertiesExcel(file),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: propertyKeys.locations() });
      queryClient.invalidateQueries({ queryKey: ["propertyStatistics"] });

      const summary = response?.summary as ImportSummary | undefined;
      const failed = summary?.failed ?? 0;
      const succeeded = (summary?.created ?? 0) + (summary?.updated ?? 0);
      const defaultMsg = response?._responseMessage ||
        getApiSuccessMessage(response) ||
        "Property Excel imported successfully";

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
      const message = getApiErrorMessage(error, "Failed to import properties");
      const description = getApiErrorDescription(error);
      toast.error(message, { description });
    },
  });
}

export function useSearchProperties(search: PropertySearchParams, enabled = true) {
  const isEnabled =
    enabled &&
    (search.mode === "circle"
      ? isValidCircleSearchParams(search.params)
      : hasPolygonCoordinates(search.params));

  const queryKey =
    search.mode === "circle"
      ? propertyKeys.searchCircle(search.params)
      : propertyKeys.searchPolygon(search.params);

  const queryFn =
    search.mode === "circle"
      ? () => propertyApi.searchPropertiesByCircle(search.params)
      : () => propertyApi.searchPropertiesByPolygon(search.params);

  return useQuery({
    queryKey,
    queryFn,
    enabled: isEnabled,
    staleTime: SEARCH_STALE_TIME,
  });
}

export function useSearchPropertiesByCircle(
  params: PropertySearchCircleParams,
  enabled = true
) {
  return useSearchProperties({ mode: "circle", params }, enabled);
}

export function useSearchPropertiesByPolygon(
  params: PropertySearchPolygonParams,
  enabled = true
) {
  return useSearchProperties({ mode: "polygon", params }, enabled);
}

export function useSearchPropertiesByCircleMutation() {
  return useMutation({
    mutationFn: (params: PropertySearchCircleParams) =>
      propertyApi.searchPropertiesByCircle(params),
    onError: handleSearchError,
  });
}

export function useSearchPropertiesByPolygonMutation() {
  return useMutation({
    mutationFn: (params: PropertySearchPolygonParams) =>
      propertyApi.searchPropertiesByPolygon(params),
    onError: handleSearchError,
  });
}

/**
 * =====================================================
 * PROPERTY APPROVAL WORKFLOW HOOKS
 * =====================================================
 */

/**
 * Submit property for review
 */
export function useSubmitPropertyForReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => propertyApi.submitForReview(id),
    onSuccess: (updatedProperty, id) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.setQueryData(propertyKeys.detail(id), updatedProperty);

      const message =
        updatedProperty?._responseMessage ||
        "Property submitted for review successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to submit property for review"));
    },
  });
}

/**
 * Approve property
 */
export function useApproveProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ApprovePropertyInput }) =>
      propertyApi.approveProperty(id, data),
    onSuccess: (updatedProperty, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.setQueryData(propertyKeys.detail(variables.id), updatedProperty);

      const message =
        updatedProperty?._responseMessage || "Property approved successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to approve property"));
    },
  });
}

/**
 * Reject property
 */
export function useRejectProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RejectPropertyInput }) =>
      propertyApi.rejectProperty(id, data),
    onSuccess: (updatedProperty, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.setQueryData(propertyKeys.detail(variables.id), updatedProperty);

      const message =
        updatedProperty?._responseMessage || "Property rejected successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to reject property"));
    },
  });
}

/**
 * Archive property
 */
export function useArchiveProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => propertyApi.archiveProperty(id),
    onSuccess: (updatedProperty, id) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.setQueryData(propertyKeys.detail(id), updatedProperty);

      const message =
        updatedProperty?._responseMessage || "Property archived successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to archive property"));
    },
  });
}

/**
 * Restore archived property
 */
export function useRestoreProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => propertyApi.restoreProperty(id),
    onSuccess: (updatedProperty, id) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.setQueryData(propertyKeys.detail(id), updatedProperty);

      const message =
        updatedProperty?._responseMessage || "Property restored successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to restore property"));
    },
  });
}

/**
 * Reassign property to a different user
 */
export function useReassignProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, newCreatorId }: { id: number; newCreatorId: number }) =>
      propertyApi.reassignProperty(id, { newCreatorId }),
    onSuccess: (updatedProperty, { id }) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      queryClient.setQueryData(propertyKeys.detail(id), updatedProperty);

      const message =
        updatedProperty?._responseMessage || "Property reassigned successfully";
      toast.success(message);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to reassign property"));
    },
  });
}
