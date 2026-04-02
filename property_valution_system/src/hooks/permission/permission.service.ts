import api from "@/lib/api";
import type {
  CreatePermissionData,
  UpdatePermissionData,
  PermissionAssignmentData,
  ApiResponse,
  Permission,
  PermissionParams
} from "@/hooks/permission/permission.types";

// Helper to build query string from params
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

export const permissionService = {
  // GET /permissions - List all permissions with optional filters
  getPermissions: async (params?: PermissionParams): Promise<ApiResponse<Permission>> => {
    const queryString = buildQueryString(params);
    const { data } = await api.get<ApiResponse<Permission>>(`/permissions${queryString}`);
    return data;
  },

  // GET /permissions/:id - Get single permission by ID
  getPermissionById: async (id: number): Promise<Permission> => {
    const { data } = await api.get<{ data: Permission }>(`/permissions/${id}`);
    return data.data;
  },

  // POST /permissions - Create new permission
  createPermission: async (permissionData: CreatePermissionData): Promise<Permission> => {
    const { data } = await api.post<{ data: Permission }>("/permissions", permissionData);
    return data.data;
  },

  // PUT /permissions/:id - Update existing permission
  updatePermission: async (
    id: number,
    permissionData: UpdatePermissionData
  ): Promise<Permission> => {
    const { data } = await api.put<{ data: Permission }>(`/permissions/${id}`, permissionData);
    return data.data;
  },

  // DELETE /permissions/:id - Deactivate permission
  deactivatePermission: async (id: number): Promise<void> => {
    await api.delete(`/permissions/${id}`);
  },

  // POST /permissions/roles - Assign permission to role
  assignPermissionToRole: async (
    data: PermissionAssignmentData
  ): Promise<{ message?: string }> => {
    const response = await api.post("/permissions/roles", data);
    return response.data as { message?: string };
  },

  // DELETE /permissions/:permissionId/roles/:roleId - Revoke permission from role
  revokePermissionFromRole: async (
    permissionId: number,
    roleId: number
  ): Promise<void> => {
    await api.delete(`/permissions/${permissionId}/roles/${roleId}`);
  },

  // GET /permissions/available?roleId=X - Get available permissions for a role
  getAvailablePermissionsForRole: async (roleId: number): Promise<ApiResponse<Permission>> => {
    const { data } = await api.get<ApiResponse<Permission>>(`/permissions/available?roleId=${roleId}`);
    return data;
  },

  // GET /permissions/validate?roleId=X&permissionId=Y - Validate permission for role
  validatePermissionForRole: async (
    roleId: number,
    permissionId: number
  ): Promise<{ isValid: boolean; message?: string }> => {
    const { data } = await api.get<{ isValid: boolean; message?: string }>(
      `/permissions/validate?roleId=${roleId}&permissionId=${permissionId}`
    );
    return data;
  },
};
