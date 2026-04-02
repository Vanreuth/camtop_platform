// hooks/role/role.api.ts
import api from "@/lib/api";
import type {
  AssignRoleData,
  CreateRoleData,
  Role,
  RoleParams,
  UpdateRoleData,
  RoleListResult,
  ApiResponseWithMessage,
} from "@/types/role.types";
import { unwrap, getApiSuccessMessage, Pagination } from "@/utils/helpers";

const buildQueryString = (params?: RoleParams): string => {
  if (!params) return "";

  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== "" && v !== "All"
    )
  );

  const searchParams = new URLSearchParams();
  Object.entries(cleanParams).forEach(([key, value]) => {
    searchParams.append(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

const createFallbackPagination = (params?: RoleParams) => {
  return {
    page: params?.page ?? 1,
    limit: params?.limit ?? 10,
    total: 0,
    totalPages: 1,
  };
};

export const roleApi = {
  /**
   * Get paginated list of roles
   */
  getRoles: async (params?: RoleParams): Promise<RoleListResult> => {
    const queryString = buildQueryString(params);
    const response = await api.get(`/roles${queryString}`);
    
    const body = response.data;
    
    // Extract message
    const message = body?.message;
    
    // Handle different response structures
    let roles: Role[] = [];
    let pagination = createFallbackPagination(params);

    if (body.success) {
      // Handle { success: true, data: { roles: [...] }, pagination: {...} }
      roles = body.data?.roles ?? body.data ?? [];
      
      if (body.pagination) {
        pagination = {
          page: body.pagination.page ?? params?.page ?? 1,
          limit: body.pagination.limit ?? params?.limit ?? 10,
          total: body.pagination.total ?? 0,
          totalPages: body.pagination.totalPages ?? 1,
        };
      } else if (body.data?.pagination) {
        pagination = {
          page: body.data.pagination.page ?? params?.page ?? 1,
          limit: body.data.pagination.limit ?? params?.limit ?? 10,
          total: body.data.pagination.total ?? 0,
          totalPages: body.data.pagination.totalPages ?? 1,
        };
      }
    } else {
      // Handle direct array response
      roles = Array.isArray(body) ? body : [];
    }

    return {
      roles,
      pagination,
      message,
    };
  },

  /**
   * Get single role by ID
   */
  getRoleById: async (id: number): Promise<ApiResponseWithMessage<Role>> => {
    const response = await api.get(`/roles/${id}`);
    const role = unwrap<Role>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...role,
      _responseMessage: message,
    };
  },

  /**
   * Create new role
   */
  createRole: async (roleData: CreateRoleData): Promise<ApiResponseWithMessage<Role>> => {
    const response = await api.post("/roles", roleData);
    const role = unwrap<Role>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...role,
      _responseMessage: message,
    };
  },

  /**
   * Update existing role
   */
  updateRole: async (
    id: number,
    roleData: UpdateRoleData
  ): Promise<ApiResponseWithMessage<Role>> => {
    const response = await api.put(`/roles/${id}`, roleData);
    const role = unwrap<Role>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...role,
      _responseMessage: message,
    };
  },

  /**
   * Delete role
   */
  deleteRole: async (id: number): Promise<{ message?: string }> => {
    const response = await api.delete(`/roles/${id}`);
    const message = getApiSuccessMessage(response.data);

    return { message };
  },

  /**
   * Assign role to user
   */
 assignRoleToUser: async (data: AssignRoleData): Promise<{ message?: string }> => {
  const response = await api.post(`/roles/assign`, data);
  return { message: getApiSuccessMessage(response.data) };
},

  /**
   * Revoke role from user
   */
  revokeRoleFromUser: async (
    userId: number,
    roleId: number
  ): Promise<{ message?: string }> => {
    const response = await api.delete(`/roles/revoke/${userId}/${roleId}`);
    const message = getApiSuccessMessage(response.data);

    return { message };
  },
};