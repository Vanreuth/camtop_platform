// hooks/permission/permission.api.ts
import api from "@/lib/api";
import type {
  CreatePermissionData,
  Permission,
  PermissionAssignmentData,
  PermissionParams,
  PermissionValidationResponse,
  UpdatePermissionData,
  PermissionListResult,
  ApiResponseWithMessage,
} from "@/hooks/permission/permission.types";
import { unwrap, getApiSuccessMessage } from "@/utils/helpers";

const buildQueryString = (params?: PermissionParams): string => {
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

const createFallbackPagination = (params?: PermissionParams) => {
  return {
    page: params?.page ?? 1,
    limit: params?.limit ?? 10,
    total: 0,
    totalPages: 1,
  };
};

export const permissionApi = {
  /**
   * Get paginated list of permissions
   */
  getPermissions: async (params?: PermissionParams): Promise<PermissionListResult> => {
    const queryString = buildQueryString(params);
    const response = await api.get(`/permissions${queryString}`);
    
    const body = response.data;
    const message = body?.message;
    
    let permissions: Permission[] = [];
    let pagination = createFallbackPagination(params);

    if (body.success) {
      permissions = body.data?.permissions ?? body.data ?? [];
      
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
      permissions = Array.isArray(body) ? body : [];
    }

    return {
      permissions,
      pagination,
      message,
    };
  },

  /**
   * Get single permission by ID
   */
  getPermissionById: async (id: number): Promise<ApiResponseWithMessage<Permission>> => {
    const response = await api.get(`/permissions/${id}`);
    const permission = unwrap<Permission>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...permission,
      _responseMessage: message,
    };
  },

  /**
   * Create new permission
   */
  createPermission: async (
    permissionData: CreatePermissionData
  ): Promise<ApiResponseWithMessage<Permission>> => {
    const response = await api.post("/permissions", permissionData);
    const permission = unwrap<Permission>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...permission,
      _responseMessage: message,
    };
  },

  /**
   * Update existing permission
   */
  updatePermission: async (
    id: number,
    permissionData: UpdatePermissionData
  ): Promise<ApiResponseWithMessage<Permission>> => {
    const response = await api.put(`/permissions/${id}`, permissionData);
    const permission = unwrap<Permission>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...permission,
      _responseMessage: message,
    };
  },

  /**
   * Deactivate permission
   */
  deactivatePermission: async (id: number): Promise<{ message?: string }> => {
    const response = await api.delete(`/permissions/${id}`);
    const message = getApiSuccessMessage(response.data);

    return { message };
  },

  /**
   * Assign permission to role
   */
  assignPermissionToRole: async (
    data: PermissionAssignmentData
  ): Promise<{ message?: string }> => {
    const response = await api.post("/permissions/roles", data);
    const message = getApiSuccessMessage(response.data);

    return { message };
  },

  /**
   * Revoke permission from role
   */
  revokePermissionFromRole: async (
    permissionId: number,
    roleId: number
  ): Promise<{ message?: string }> => {
    const response = await api.delete(`/permissions/${permissionId}/roles/${roleId}`);
    const message = getApiSuccessMessage(response.data);

    return { message };
  },

  /**
   * Get available permissions for role
   */
 // Update this signature to accept params
getAvailablePermissionsForRole: async (
  roleId: number, 
  params?: { page?: number; limit?: number; search?: string }
): Promise<PermissionListResult> => {
  
  // MERGE the roleId with the pagination params
  const response = await api.get(`/permissions/available`, { 
    params: { 
      roleId, 
      ...params // <--- This sends limit=1000 to the backend
    } 
  });
  
  const body = response.data;
  const message = body?.message;
  
  let permissions: Permission[] = [];
  // Update fallback to use the actual requested params
  let pagination = createFallbackPagination(params); 

  if (body.success) {
    permissions = body.data?.permissions ?? body.data ?? [];
    // If backend returns real pagination, use it
    if (body.data?.pagination) {
        pagination = body.data.pagination;
    }
  } else {
    permissions = Array.isArray(body) ? body : [];
  }

  return {
    permissions,
    pagination,
    message,
  };
},

  /**
   * Validate permission for role
   */
  validatePermissionForRole: async (
    roleId: number,
    permissionId: number
  ): Promise<PermissionValidationResponse> => {
    const response = await api.get(`/permissions/validate`, {
      params: { roleId, permissionId },
    });
    return unwrap<PermissionValidationResponse>(response.data);
  },
};