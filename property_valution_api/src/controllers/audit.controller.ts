import { AuditController } from "../modules/audit/audit.controller";

export const auditLog = AuditController.getAuditLogs;
export const getUserLogs = AuditController.getUserAuditLogs;
export const getSummary = AuditController.getAuditSummary;
export const logAction = AuditController.logAction;
export const cleanup = AuditController.cleanup;

export const logLoginSession = AuditController.logLoginSession;
