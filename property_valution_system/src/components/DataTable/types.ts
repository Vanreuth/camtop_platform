export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render: (value: any, row: T) => React.ReactNode;
}

export interface FilterOption {
  label: string;
  value: string | number;
  // Allow any extra properties for dependencies (like provinceId, districtId)
  [key: string]: any; 
}

export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "text" | "number" | "date" | "daterange" | "search";
  dependsOn?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: FilterOption[];
  defaultValue?: string | number | boolean | undefined;
}

export interface DataTableConfig<T> {
  columns: Column<T>[];
  filters?: FilterConfig[];
  title?: string;
  description?: string;
  searchPlaceholder?: string;
  defaultPageSize?: number;
  defaultSortBy?: string;
  defaultSortOrder?: "asc" | "desc";
  forcedParams?: Record<string, string | number | boolean | Date | null | undefined>;
}

export interface ApiParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  [key: string]: any;
}

export interface ApiResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "select" | "textarea" | "password";
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  defaultValue?: any;
  validation?: (value: any) => string | undefined;
  icon?: React.ComponentType<{ className?: string }>;
  // sort: number;
}
