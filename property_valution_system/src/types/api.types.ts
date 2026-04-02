export interface AuditLog {
  id: number;
  action: string;
  userId?: number;
  entity?: string;
  entityId?: number;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    email: string;
  };
}

export interface SearchFilters {
  userId?: number;
  action?: string;
  entity?: string;
  ipAddress?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface AuditLogResult {
  logs: AuditLog[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AuditSummary {
  actionSummary: Array<{
    action: string;
    count: number;
  }>;
  entitySummary: Array<{
    entity: string;
    count: number;
  }>;
  recentActivity: AuditLog[];
  dailyStats: Record<string, number>;
  period: string;
}

export interface ApiResponse<T> {
  status: "success" | "error";
  message: string;
  data: T;
}
