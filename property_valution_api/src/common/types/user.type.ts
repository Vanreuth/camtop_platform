import { AccountStatus } from "@prisma/client";
export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profilePicture?: string;
  bio?: string;
  status?: AccountStatus;
}
export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phone?: string;
  profilePicture?: string;
  bio?: string;
  status?: AccountStatus;
}

export type UpdateMeDto = {
  profile?: {
    firstName?: string;
    lastName?: string;
    bio?: string;
    email?: string;
    username?: string;
    phone?: string;
    profilePicture?: string;
    status?: AccountStatus;
  };
  preferences?: {
    theme?: string;
    language?: string;
    timezone?: string;
    accentColor?: string;
    borderRadius?: string;
    fontFamily?: string;
    fontSize?: string;
    themePreset?: string;
    themeColor?: string;
  };
};

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profilePicture?: string;
}
export interface SearchFilters {
  status?: AccountStatus;
  role?: string;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}
export interface PaginationOptions {
  page?: number;
  limit?: number;
  skip?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
export interface CreateUserOptions {
  assignedBy: number; // User ID who is creating/assigning the role
  roleId: number;
}
