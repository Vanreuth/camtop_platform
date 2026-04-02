export interface Permission {
  id: number;
  permissionName: string;
  permissionCode: string;
  action: string;
  resource: string;
}
export interface RolePermission {
  permission: Permission;
}
export interface Role {
  id: number;
  roleName: string;
  roleCode: string;
  permissions: RolePermission[];
}
export interface UserRole {
  userId: number;
  roleId: number;
  assignedAt: string;
  assignedBy: number;
  isActive: boolean;
  role: Role;
}

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  phone?: string;
  bio?: string;
  profilePicture?: string;
  createdAt: string;
  updatedAt: string;
  roles: UserRole[];
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status?: "ACTIVE" | "INACTIVE";
  roleId: number; // Required for backend
  assignedBy?: number; // Will be set by backend from auth
}
export interface UpdateUserData {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: "ACTIVE" | "INACTIVE";
  roleId?: number;
  profilePicture?: string;
}
export interface ApiParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: string;
  role?: string;
  roleId?: number;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiResponse<T> {
  status: string;
  message: string;
  data: {               // <--- data is an OBJECT
    users: T[];         // <--- The ARRAY is here
    pagination: Pagination;
  };
}
export interface UserStatsResponse {
  status: string;
  message: string;
  data: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    recentUsers: number;
  };
}
