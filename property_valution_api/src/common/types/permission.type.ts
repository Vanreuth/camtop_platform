import { ActionType } from "@prisma/client";

export interface Permission {
  id: number;
  permissionName: string;
  permissionCode: string;
  resource: string;
  action: ActionType;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionWithRelations extends Permission {
  roles: Array<{
    id: number;
    roleId: number;
    permissionId: number;
    assignedBy: number;
    assignedAt: Date;
    role: {
      id: number;
      roleName: string;
      roleCode: string;
    };
  }>;
  assignedByUser?: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
  };
  assignedAt?: Date;
}

export interface CreatePermissionData {
  permissionName: string;
  permissionCode: string;
  resource: string;
  action: ActionType;
  description?: string;
}

export interface UpdatePermissionData {
  permissionName?: string;
  permissionCode?: string;
  resource?: string;
  action?: ActionType;
  description?: string;
  isActive?: boolean;
}

export interface PermissionFilters {
  resource?: string;
  action?: ActionType;
  isActive?: boolean;
  roleId?: number;
  search?: string;
}

export interface PaginationOptions {
  skip?: number;
  take?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedPermissionsResponse {
  permissions: PermissionWithRelations[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PermissionAssignmentData {
  roleId: number;
  permissionId: number;
  assignedBy: number;
}

export interface RoleWithHierarchy {
  id: number;
  roleName: string;
  roleCode: string;
  hierarchyLevel: number;
  isActive: boolean;
}

export interface PermissionAssignmentResult {
  id: number;
  roleId: number;
  permissionId: number;
  assignedBy: number;
  assignedAt: Date;
}
