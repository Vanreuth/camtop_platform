import type { Prisma } from "@prisma/client";
import { AuditService as ModuleAuditService } from "../modules/audit/audit.service";
import type {
  AuditCleanupRetention,
  AuditFilters as SearchFilters,
  AuditPaginationOptions as PaginationOptions,
  AuditLogResult,
} from "../modules/audit/audit.type";

const service = new ModuleAuditService();

const createAuditLog = async (
  action: string,
  userId?: number,
  entity?: string,
  entityId?: number,
  details?: Prisma.InputJsonValue,
  ipAddress?: string,
  userAgent?: string
) => {
  return service.logAction(
    action,
    userId,
    entity,
    entityId,
    details,
    ipAddress,
    userAgent
  );
};

export const AuditService = {
  getAuditLogs: (filters: SearchFilters = {}, pagination: PaginationOptions = {}) =>
    service.getAuditLogs(filters, pagination),
  getUserAuditLogs: (userId: number, pagination: PaginationOptions = {}) =>
    service.getUserAuditLogs(userId, pagination),
  getAuditSummary: (userId?: number, days?: number) =>
    service.getAuditSummary(userId, days),
  createAuditLog,
  logAction: createAuditLog,
  cleanupOldLogs: (retention?: AuditCleanupRetention) =>
    service.cleanupOldLogs(retention),
};

export type { SearchFilters, PaginationOptions, AuditLogResult };
