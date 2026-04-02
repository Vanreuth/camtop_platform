
import { AxiosError } from "axios";


export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export const defaultPagination = (page = 1, limit = 10): Pagination => ({
  page,
  limit,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
});

export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
  pagination?: Pagination;
};

export type ApiFail = {
  success: false;
  message: string;
  code?: string;
  errors?: { path?: string; message: string }[];
};

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFail;

export const unwrap = <T,>(body: any): T => {
  const env = body as ApiEnvelope<T>;
  if (typeof env?.success === "boolean") {
    if (!env.success) throw env;
    return env.data;
  }
  return (body?.data ?? body) as T;
};

export const unwrapPage = <T,>(body: any) => {
  const env = body as ApiEnvelope<T>;

  if (typeof env?.success === "boolean") {
    if (!env.success) throw env;

    return {
      data: env.data,
      pagination: env.pagination,
      message: env.message,
    };
  }

  return {
    data: (body?.data ?? body) as T,
    pagination: undefined,
    message: undefined,
  };
};

export const getApiSuccessMessage = (response: any): string | undefined => {
  return response?.message || response?.data?.message;
};

// ✅ IMPROVED: Extract error message from API
export const getApiErrorMessage = (err: unknown, fallback = "Request failed"): string => {
  try {
    const ax = err as AxiosError<ApiFail>;
    
    // Check for API error message
    const apiMessage = ax?.response?.data?.message;
    if (typeof apiMessage === "string" && apiMessage) return apiMessage;
    
    // Check for axios error message
    if (typeof ax?.message === "string" && ax.message) return ax.message;
    
    // Check for generic Error
    if (err instanceof Error && err.message) return err.message;
    
    // If err is already a string
    if (typeof err === "string" && err) return err;
    
    return fallback;
  } catch {
    // Defensive: if any error during extraction, return fallback
    return fallback;
  }
};

// ✅ IMPROVED: Extract detailed error description
export const getApiErrorDescription = (err: unknown): string | undefined => {
  try {
    const ax = err as AxiosError<ApiFail>;
    const errors = ax?.response?.data?.errors ?? [];
    
    if (!errors.length) {
      // If no field errors, try to get the error code
      const code = ax?.response?.data?.code;
      return code ? `Error code: ${code}` : undefined;
    }
    
    return errors
      .slice(0, 3)
      .map((e) => (e.path ? `${e.path}: ${e.message}` : e.message))
      .join(" • ");
  } catch {
    // Defensive: if any error during extraction, return undefined
    return undefined;
  }
};

export const toFormData = (values: Record<string, unknown>) => {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof File) {
      formData.append(key, value);
      return;
    }
    formData.append(key, String(value));
  });

  return formData;
};



