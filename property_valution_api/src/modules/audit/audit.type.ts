import type { Prisma } from "@prisma/client";

export interface AuditFilters {
  userId?: number;
  action?: string;
  entity?: string;
  entityId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  ipAddress?: string;
}

export type AuditCleanupPeriod = "7d" | "15d" | "1m" | "3m" | "6m" | "1y";
export type AuditCleanupRetention = number | AuditCleanupPeriod;

export interface AuditPaginationOptions {
  skip?: number;
  take?: number;
  sortBy?: "createdAt" | "action" | "entity" | "userId";
  sortOrder?: "asc" | "desc";
}

export interface AuditLogResult {
  logs: unknown[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface AuditSummaryResult {
  actionSummary: Array<{ action: string; count: number }>;
  entitySummary: Array<{ entity: string; count: number }>;
  recentActivity: unknown[];
  dailyStats: Record<string, number>;
  period: {
    days: number;
    from: string;
    to: string;
  };
}

export interface CreateAuditLogInput {
  action: string;
  userId?: number;
  entity?: string;
  entityId?: number;
  details?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}
