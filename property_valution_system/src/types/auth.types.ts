export interface UserRole {
  roleId: number;
  roleCode: string;
  roleName: string;
  permiissions?: {
    permissionCode: string;
  }[];
}

export interface AuthUser {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string | null;
  bio?: string | null;
  status: string;
  roles: UserRole[];
  permissions?: string[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  token: string;
  refreshToken?: string;
}

export interface RegisterResponse {
  user: AuthUser;
  token?: string;
  refreshToken?: string;
}

export interface UpdateUserProfile {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  profilePicture?: File;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

// API Response types (matching your backend structure)
export interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export interface LoginApiResponse {
  user: {
    id: number;
    email: string;
    lastName: string;
    firstName: string;
    username: string;
    role: string;
    profilePicture?: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface ProfileApiResponse {
  message: string;
  user: {
    id: number;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    bio?: string;
    status: string;
    roles: Array<{
      userId: number;
      roleId: number;
      assignedAt: string;
      assignedBy: number;
      role: {
        id: number;
        roleName: string;
        roleCode: string;
        description: string;
        hierarchyLevel: number;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
        permissions: Array<{
          roleId: number;
          permissionId: number;
          assignedAt: string;
          assignedBy: number;
        }>;
      };
    }>;
  };
}

export interface UpdateProfileApiResponse {
  message: string;
  user: {
    email?: string;
    firstName?: string;
    lastName?: string;
    bio?: string;
    profilePicture?: string;
  };
}
