export type AuditSortBy = "createdAt" | "action" | "entity" | "userId";

export interface AuditLogUser {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface AuditLog {
  id: number;
  action: string;
  userId?: number;
  entity?: string;
  entityId?: number;
  details?: unknown;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: AuditLogUser;
}

export interface SearchFilters {
  userId?: number;
  action?: string;
  entity?: string;
  entityId?: number;
  ipAddress?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: AuditSortBy;
  sortOrder?: "asc" | "desc";
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface AuditLogResult {
  logs: AuditLog[];
  pagination: PaginationMeta;
  message?: string;
}

export interface AuditSummary {
  actionSummary: Array<{ action: string; count: number }>;
  entitySummary: Array<{ entity: string; count: number }>;
  recentActivity: AuditLog[];
  dailyStats: Record<string, number>;
  period: {
    days: number;
    from: string;
    to: string;
  };
}

export interface AuditSummaryResult {
  summary: AuditSummary;
  message?: string;
}

export interface CreateAuditLogInput {
  action: string;
  entity?: string;
  entityId?: number;
  details?: unknown;
}
