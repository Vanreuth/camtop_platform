// hooks/role/useRole.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  AssignRoleData,
  CreateRoleData,
  Role,
  RoleParams,
  UpdateRoleData,
  RoleListResult,
} from "@/types/role.types";
import { roleApi } from "./role.api";
import { getApiErrorMessage, getApiErrorDescription } from "@/utils/helpers";

// ============= QUERY KEYS =============
export const roleKeys = {
  all: ["roles"] as const,
  lists: () => [...roleKeys.all, "list"] as const,
  list: (params?: RoleParams) => [...roleKeys.lists(), params] as const,
  details: () => [...roleKeys.all, "detail"] as const,
  detail: (id: number) => [...roleKeys.details(), id] as const,
};

// ============= QUERIES =============

/**
 * Get paginated list of roles
 */
export function useRoles(params?: RoleParams) {
  return useQuery({
    queryKey: roleKeys.list(params),
    queryFn: () => roleApi.getRoles(params),
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Get single role by ID
 */
export function useRole(id: number, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? !!id;

  return useQuery({
    queryKey: roleKeys.detail(id),
    queryFn: () => roleApi.getRoleById(id),
    enabled,
    staleTime: 60_000,
  });
}

// ============= MUTATIONS =============

/**
 * Create new role
 */
export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoleData) => roleApi.createRole(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });

      // ✅ Use API message
      const message = response._responseMessage || "Role created successfully";
      toast.success(message, {
        description: `${response.roleName} has been created`,
      });
    },
    onError: (error) => {
      // ✅ Extract error from API
      const message = getApiErrorMessage(error, "Failed to create role");
      const description = getApiErrorDescription(error);

      toast.error(message, { description });
    },
  });
}

/**
 * Update existing role
 */
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateRoleData }) =>
      roleApi.updateRole(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: roleKeys.detail(variables.id) });

      // ✅ Use API message
      const message = response._responseMessage || "Role updated successfully";
      toast.success(message, {
        description: `${response.roleName} has been updated`,
      });
    },
    onError: (error) => {
      // ✅ Extract error from API
      const message = getApiErrorMessage(error, "Failed to update role");
      const description = getApiErrorDescription(error);

      toast.error(message, { description });
    },
  });
}

/**
 * Delete role
 */
export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => roleApi.deleteRole(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });
      queryClient.removeQueries({ queryKey: roleKeys.detail(id) });

      // ✅ Use API message
      const message = response.message || "Role deleted successfully";
      toast.success(message);
    },
    onError: (error) => {
      // ✅ Extract error from API
      const message = getApiErrorMessage(error, "Failed to delete role");
      const description = getApiErrorDescription(error);

      toast.error(message, { description });
    },
  });
}

/**
 * Assign role to user
 */
export function useAssignRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssignRoleData) => roleApi.assignRoleToUser(data),

    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["users"], exact: false });
      queryClient.invalidateQueries({ queryKey: roleKeys.lists(), exact: false });
      toast.success(response.message || "Role assigned successfully");
    },
  });
}


/**
 * Revoke role from user
 */
export function useRevokeRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) =>
      roleApi.revokeRoleFromUser(userId, roleId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: roleKeys.lists() });

      // ✅ Use API message
      const message = response.message || "Role revoked successfully";
      toast.success(message);
    },
    onError: (error) => {
      // ✅ Extract error from API
      const message = getApiErrorMessage(error, "Failed to revoke role");
      const description = getApiErrorDescription(error);

      toast.error(message, { description });
    },
  });
}