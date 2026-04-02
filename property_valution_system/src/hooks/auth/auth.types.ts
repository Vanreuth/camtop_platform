export type AuthUser = {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePicture: string | null;
  bio?: string;
  status?: string;
  phone?: string;
  roles: Role[];
  permissions: string[];
};

export type Role = {
  roleId: number;
  roleName: string;
  roleCode: string;
  hierarchyLevel?: number;
  isActive?: boolean;
};


export type RegisterInput = {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: File;
};

export type UpdateProfileInput = {
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  profilePicture?: File;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type LoginResponse = {
  message: string;
  data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  };
};

export type MeResponse = {
  status: "success";
  data: AuthUser;
};

export type RefreshResponse = {
  status: "success";
  data: {
    accessToken: string;
    refreshToken?: string;
  };
};

export type ApiResponse<T = any> = {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: Array<{
    path: string;
    message: string;
  }>;
};
