// hooks/user/user.api.t
import type {
  ApiParams,
  CreateUserData,
  UpdateUserData,
  User,
} from "@/types/user.types";
import { unwrapPage, unwrap, Pagination, getApiSuccessMessage} from "@/utils/helpers";
import api from "@/lib/api";

export type UserListResult = {
  users: User[];
  pagination: Pagination;
  message?: string;
};

// ✅ NEW: Type for responses with messages
export type ApiResponseWithMessage<T> = T & {
  _responseMessage?: string;
};

type UsersData = { users: User[] };

const buildQueryString = (params: ApiParams): string => {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(
      ([_, v]) => v !== undefined && v !== null && v !== "" && v !== "All"
    )
  );

  return new URLSearchParams(
    Object.entries(cleaned).map(([key, value]) => [key, String(value)])
  ).toString();
};

const createFallbackPagination = (params: ApiParams): Pagination => {
  const page = Number(params.page ?? 1);
  const limit = Number(params.limit ?? 10);

  return {
    page,
    limit,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: page > 1,
  };
};

export const userApi = {
  getUsers: async (params: ApiParams = {
    page: 0,
    limit: 0
  }): Promise<UserListResult> => {
    const queryString = buildQueryString(params);
    const url = queryString ? `/users?${queryString}` : "/users";

    const response = await api.get(url);
    const { data: responseData, pagination, message } = unwrapPage<UsersData>(response.data);

    return {
      users: responseData?.users ?? [],
      pagination: pagination ?? createFallbackPagination(params),
      message, 
    };
  },

  getUserById: async (id: number): Promise<ApiResponseWithMessage<User>> => {
    const response = await api.get(`/users/${id}`);
    const user = unwrap<User>(response.data);
    const message = getApiSuccessMessage(response.data);
    
    return {
      ...user,
      _responseMessage: message,
    };
  },

  createUser: async (userData: CreateUserData | FormData): Promise<ApiResponseWithMessage<User>> => {
    const config = userData instanceof FormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;

    const response = await api.post("/users", userData, config);
    const user = unwrap<User>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...user,
      _responseMessage: message,
    };
  },

  updateUser: async (
    id: number,
    userData: UpdateUserData | FormData
  ): Promise<ApiResponseWithMessage<User>> => {
    const config = userData instanceof FormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;

    const response = await api.put(`/users/${id}`, userData, config);
    const user = unwrap<User>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...user,
      _responseMessage: message,
    };
  },

  deleteUser: async (id: number): Promise<{ message?: string }> => {
    const response = await api.delete(`/users/${id}`);
    const message = getApiSuccessMessage(response.data);
    
    return { message };
  },

  reactivateUser: async (id: number): Promise<ApiResponseWithMessage<User>> => {
    const response = await api.put(`/users/reactivate/${id}`);
    const user = unwrap<User>(response.data);
    const message = getApiSuccessMessage(response.data);

    return {
      ...user,
      _responseMessage: message,
    };
  },

  bulkDeleteUsers: async (ids: number[]): Promise<{ message?: string }> => {
    const response = await api.post("/users/bulk-delete", { ids });
    const message = getApiSuccessMessage(response.data);
    
    return { message };
  },

  getUserStatistics: async (filters?: {
    startDate?: string;
    endDate?: string;
    roleId?: number;
  }): Promise<UserStatisticsResponse> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.roleId) params.append("roleId", String(filters.roleId));

    const queryString = params.toString();
    const url = queryString ? `/users/statistics?${queryString}` : "/users/statistics";

    const response = await api.get(url);
    return response.data?.data || response.data;
  },
};

// Types for user statistics
export interface UserStatisticsResponse {
  overview: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    suspendedUsers: number;
    recentUsers: number;
    usersThisMonth: number;
    usersWithValuations: number;
  };
  byStatus: {
    ACTIVE: number;
    INACTIVE: number;
    SUSPENDED: number;
  };
  byRole: Array<{
    roleId: number;
    roleName: string;
    roleCode: string;
    count: number;
  }>;
  topValuers: Array<{
    valuerId: number | null;
    valuerName: string;
    profilePicture: string | null;
    valuationCount: number;
    avgMarketValue: number | null;
  }>;
  trends: {
    monthly: Array<{
      month: string;
      count: number;
    }>;
  };
}