export interface Role {
  id: number;
  roleName: string;
  roleCode: string;
  description?: string;
  hierarchyLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoleData {
  roleName: string;
  roleCode: string;
  description?: string;
  hierarchyLevel: number;
}
export interface UpdateRoleData {
  roleName?: string;
  roleCode?: string;
  description?: string;
  hierarchyLevel?: number;
}
export interface SearchFilters {
  status?: string;
  search?: string;
  role?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  hierarchyLevel?: number;
  hasUsers?: boolean;
  hasPermissions?: boolean;
}

export interface PaginationOptions {
  skip?: number;
  take?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedRolesResponse {
  roles: Role[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface RoleAssignmentData {
  userId: number;
  roleId: number;
  assignedBy: number;
}
