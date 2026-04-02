// hooks/permission/usePermission.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreatePermissionData,
  Permission,
  PermissionParams,
  UpdatePermissionData,
} from "@/hooks/permission/permission.types";
import { permissionApi } from "./permission.api";
import { getApiErrorMessage, getApiErrorDescription } from "@/utils/helpers";

export const permissionKeys = {
  all: ["permissions"] as const,
  lists: () => [...permissionKeys.all, "list"] as const,
  list: (params?: PermissionParams) => [...permissionKeys.lists(), params] as const,
  details: () => [...permissionKeys.all, "detail"] as const,
  detail: (id: number) => [...permissionKeys.details(), id] as const,
  available: (roleId: number) => [...permissionKeys.all, "available", roleId] as const,
};

// ============= QUERIES =============

export function usePermissions(params?: PermissionParams) {
  return useQuery({
    queryKey: permissionKeys.list(params),
    queryFn: () => permissionApi.getPermissions(params),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}

export function usePermission(id: number, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? !!id;

  return useQuery({
    queryKey: permissionKeys.detail(id),
    queryFn: () => permissionApi.getPermissionById(id),
    enabled,
    staleTime: 60_000,
  });
}

export function useAvailablePermissions(
  roleId: number, 
  params?: { page?: number; limit?: number; search?: string }, // Add params argument
  enabled = true
) {
  return useQuery({
    // Add params to the key so it's unique per limit/page
    queryKey: [...permissionKeys.available(roleId), params], 
    
    // Pass params to the API function
    queryFn: () => permissionApi.getAvailablePermissionsForRole(roleId, params),
    
    enabled: enabled && !!roleId,
    staleTime: 30_000,
  });
}

// ============= MUTATIONS =============

export function useCreatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePermissionData) => permissionApi.createPermission(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.lists() });

      const message = response._responseMessage || "Permission created successfully";
      toast.success(message, {
        description: `${response.permissionName} has been created`,
      });
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Failed to create permission");
      const description = getApiErrorDescription(error);
      toast.error(message, { description });
    },
  });
}

export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePermissionData }) =>
      permissionApi.updatePermission(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: permissionKeys.detail(variables.id) });

      const message = response._responseMessage || "Permission updated successfully";
      toast.success(message, {
        description: `${response.permissionName} has been updated`,
      });
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Failed to update permission");
      const description = getApiErrorDescription(error);
      toast.error(message, { description });
    },
  });
}

export function useDeactivatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => permissionApi.deactivatePermission(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: permissionKeys.lists() });
      queryClient.removeQueries({ queryKey: permissionKeys.detail(id) });

      const message = response.message || "Permission deactivated successfully";
      toast.success(message);
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Failed to deactivate permission");
      const description = getApiErrorDescription(error);
      toast.error(message, { description });
    },
  });
}

export function useAssignPermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { roleId: number; permissionId: number }) =>
      permissionApi.assignPermissionToRole({
        roleId: data.roleId,
        permissionId: data.permissionId,
      }),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({
        queryKey: permissionKeys.available(variables.roleId),
      });

      const message = response.message || "Permission assigned successfully";
      toast.success(message);
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Failed to assign permission");
      const description = getApiErrorDescription(error);
      toast.error(message, { description });
    },
  });
}

export function useRevokePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ permissionId, roleId }: { permissionId: number; roleId: number }) =>
      permissionApi.revokePermissionFromRole(permissionId, roleId),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({
        queryKey: permissionKeys.available(variables.roleId),
      });

      const message = response.message || "Permission revoked successfully";
      toast.success(message);
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Failed to revoke permission");
      const description = getApiErrorDescription(error);
      toast.error(message, { description });
    },
  });
}

export function useValidatePermission(
  roleId: number,
  permissionId: number,
  enabled = true
) {
  return useQuery({
    queryKey: [...permissionKeys.all, "validate", roleId, permissionId],
    queryFn: () => permissionApi.validatePermissionForRole(roleId, permissionId),
    enabled: enabled && !!roleId && !!permissionId,
    staleTime: 30_000,
  });
}