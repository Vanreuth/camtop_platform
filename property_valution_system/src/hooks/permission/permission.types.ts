// Base Permission interface
export interface Permission {
  id: number;
  permissionCode: string;
  permissionName: string;
  description?: string;
  module: string;
  resource: string;
  action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "MANAGE" | "EXECUTE";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  roles?: RolePermission[];
  _count?: {
    rolePermissions: number;
  };
}

// Role Permission relationship
export interface RolePermission {
  roleId: number;
  permissionId: number;
  grantedAt: string;
  role?: {
    id: number;
    roleCode: string;
    roleName: string;
    hierarchyLevel: number;
  };
}

// Create Permission Data
export interface CreatePermissionData {
  permissionCode: string;
  permissionName: string;
  description?: string;
  module?: string;
  resource: string;
  action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "MANAGE" | "EXECUTE";
  isActive?: boolean;
}

// Update Permission Data
export interface UpdatePermissionData {
  permissionCode?: string;
  permissionName?: string;
  description?: string;
  module?: string;
  resource?: string;
  action?: "CREATE" | "READ" | "UPDATE" | "DELETE" | "MANAGE" | "EXECUTE";
  isActive?: boolean;
}

// Permission Assignment Data
export interface PermissionAssignmentData {
  roleId: number;
  permissionId: number;
}

// Query Parameters for filtering/pagination
export interface PermissionParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  isActive?: boolean;
  module?: string;
  resource?: string;
  action?: "CREATE" | "READ" | "UPDATE" | "DELETE" | "MANAGE" | "EXECUTE";
  roleId?: number; // For filtering permissions by role
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

// Permission validation response
export interface PermissionValidationResponse {
  isValid: boolean;
  message?: string;
  permission?: Permission;
  role?: {
    id: number;
    roleName: string;
    roleCode: string;
  };
}

export interface PermissionListResult {
  permissions: Permission[];
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