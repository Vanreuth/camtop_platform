// Base Role interface
export interface Role {
  id: number;
  roleCode: string;
  roleName: string;
  description?: string;
  hierarchyLevel?: number;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  permissions?: Permission[];
  _count?: {
    userRoles: number;
    rolePermissions: number;
  };
}

// Permission interface
export interface Permission {
  id: number;
  permissionCode: string;
  permissionName: string;
  description?: string;
  module: string;
  isActive: boolean;
}

// Role Permission relationship
export interface RolePermission {
  roleId: number;
  permissionId: number;
  grantedAt: string;
  permission?: Permission;
}

// Create Role Data
export interface CreateRoleData {
  roleCode: string;
  roleName: string;
  description?: string;
  hierarchyLevel?: number;
  isActive?: boolean;
  permissionIds?: number[]; // IDs of permissions to assign
}

// Update Role Data
export interface UpdateRoleData {
  roleCode?: string;
  roleName?: string;
  description?: string;
  hierarchyLevel?: number;
  isActive?: boolean;
  permissionIds?: number[]; // IDs of permissions to assign/update
}

// Assign Role to User
export interface AssignRoleData {
  roleIds: number[];
  userId: number; // Can assign multiple roles at once
}

// Query Parameters for filtering/pagination
export interface RoleParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  isActive?: boolean;
  isSystem?: boolean;
  hierarchyLevel?: number;
}

// API Response wrapper
export interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Single item response
export interface SingleResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export interface RoleListResult {
  roles: Role[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
}

export type ApiResponseWithMessage<T> = T & {
  _responseMessage?: string;
};