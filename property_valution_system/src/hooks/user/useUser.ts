// hooks/user/useUser.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApiParams, ApiResponse, UpdateUserData, User } from "@/types/user.types";
import { userApi, type UserStatisticsResponse } from "./user.api";
import { getApiErrorMessage, getApiErrorDescription } from "@/utils/helpers";
import { useAuth } from "../auth/useAuth";

export type UserStatisticsFilters = {
  startDate?: string;
  endDate?: string;
  roleId?: number;
};

export const userQueryKeys = {
  all: ["users"] as const,
  lists: () => [...userQueryKeys.all, "list"] as const,
  list: (params: ApiParams) => [...userQueryKeys.lists(), params] as const,
  details: () => [...userQueryKeys.all, "detail"] as const,
  detail: (id: number) => [...userQueryKeys.details(), id] as const,
  stats: () => [...userQueryKeys.all, "stats"] as const,
  statistics: (filters?: UserStatisticsFilters) => [...userQueryKeys.all, "statistics", filters] as const,
};

export function useUsers(params: ApiParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userQueryKeys.list(params),
    queryFn: () => userApi.getUsers(params),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    enabled: options?.enabled ?? true,
  });
}

export function useUser(id: number, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? (Number.isFinite(id) && id > 0);

  return useQuery({
    queryKey: userQueryKeys.detail(id),
    queryFn: () => userApi.getUserById(id),
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}

// ============= MUTATIONS =============

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userApi.createUser,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.stats() });

      // ✅ Use API message if available
      const message = response._responseMessage || "User created successfully";
      
      toast.success(message, {
        description: `${response.firstName} ${response.lastName} has been added`,
      });
    },
    onError: (error) => {
      // ✅ Extract error message from API response
      const message = getApiErrorMessage(error, "Failed to create user");
      const description = getApiErrorDescription(error);
      
      toast.error(message, {
        description,
      });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateUserData | FormData;
    }) => userApi.updateUser(id, data),

    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({
        queryKey: userQueryKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.stats() });
      if (currentUser?.id === variables.id) {
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      }

      // ✅ Use API message
      const message = response._responseMessage || "User updated successfully";
      
      toast.success(message, {
        description: `${response.firstName} ${response.lastName}'s information has been updated`,
      });
    },

    onError: (error) => {
      // ✅ Extract error from API
      const message = getApiErrorMessage(error, "Failed to update user");
      const description = getApiErrorDescription(error);
      
      toast.error(message, {
        description,
      });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userApi.deleteUser,
    onSuccess: (response, deletedId) => {
      queryClient.removeQueries({ queryKey: userQueryKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.stats() });

      // ✅ Use API message
      const message = response.message || "User deleted successfully";
      
      toast.success(message);
    },
    onError: (error) => {
      // ✅ Extract error from API
      const message = getApiErrorMessage(error, "Failed to delete user");
      const description = getApiErrorDescription(error);
      
      toast.error(message, {
        description,
      });
    },
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userApi.reactivateUser,
    onSuccess: (response, userId) => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.detail(userId) });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.stats() });

      // ✅ Use API message
      const message = response._responseMessage || "User reactivated successfully";
      
      toast.success(message, {
        description: `${response.username} is now active`,
      });
    },
    onError: (error) => {
      // ✅ Extract error from API
      const message = getApiErrorMessage(error, "Failed to reactivate user");
      const description = getApiErrorDescription(error);
      
      toast.error(message, {
        description,
      });
    },
  });
}

export function useBulkDeleteUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userApi.bulkDeleteUsers,
    onSuccess: (response, deletedIds) => {
      deletedIds.forEach((id) => {
        queryClient.removeQueries({ queryKey: userQueryKeys.detail(id) });
      });

      queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.stats() });

      // ✅ Use API message
      const message = response.message || `${deletedIds.length} users deleted successfully`;
      
      toast.success(message);
    },
    onError: (error) => {
      // ✅ Extract error from API
      const message = getApiErrorMessage(error, "Failed to delete users");
      const description = getApiErrorDescription(error);
      
      toast.error(message, {
        description,
      });
    },
  });
}

// ============= STATISTICS =============

export function useUserStatistics(filters?: UserStatisticsFilters) {
  return useQuery({
    queryKey: userQueryKeys.statistics(filters),
    queryFn: () => userApi.getUserStatistics(filters),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}