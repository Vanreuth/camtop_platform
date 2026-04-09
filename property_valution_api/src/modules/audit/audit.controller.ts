import type { Response } from "express";
import type { AuthRequest } from "../../common/types/auth.type";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { successResponse } from "../../common/utils/responseHelper";
import { AuditService } from "./audit.service";
import type { AuditCleanupPeriod, AuditCleanupRetention } from "./audit.type";

const service = new AuditService();
const CLEANUP_PERIOD_LABEL: Record<AuditCleanupPeriod, string> = {
  "7d": "7 days",
  "15d": "15 days",
  "1m": "1 month",
  "3m": "3 months",
  "6m": "6 months",
  "1y": "1 year",
};

function toNumber(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toCleanupPeriod(value: unknown): AuditCleanupPeriod | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");

  if (normalized === "7d" || normalized === "7day" || normalized === "7days") {
    return "7d";
  }

  if (normalized === "15d" || normalized === "15day" || normalized === "15days") {
    return "15d";
  }

  if (normalized === "1m" || normalized === "1month" || normalized === "1months") {
    return "1m";
  }

  if (normalized === "3m" || normalized === "3month" || normalized === "3months") {
    return "3m";
  }

  if (normalized === "6m" || normalized === "6month" || normalized === "6months") {
    return "6m";
  }

  if (normalized === "1y" || normalized === "1year" || normalized === "12m") {
    return "1y";
  }

  return undefined;
}

export class AuditController {
  static async getAuditLogs(req: AuthRequest, res: Response) {
    const page = Math.max(1, toNumber(req.query.page) ?? 1);
    const limit = Math.min(100, Math.max(1, toNumber(req.query.limit) ?? 20));

    const filters = {
      userId: toNumber(req.query.userId),
      action: typeof req.query.action === "string" ? req.query.action : undefined,
      entity: typeof req.query.entity === "string" ? req.query.entity : undefined,
      entityId: toNumber(req.query.entityId),
      ipAddress:
        typeof req.query.ipAddress === "string" ? req.query.ipAddress : undefined,
      dateFrom: toDate(req.query.dateFrom),
      dateTo: toDate(req.query.dateTo),
    };

    const sortBy =
      typeof req.query.sortBy === "string" ? req.query.sortBy : "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

    const result = await service.getAuditLogs(filters, {
      skip: (page - 1) * limit,
      take: limit,
      sortBy: sortBy as "createdAt" | "action" | "entity" | "userId",
      sortOrder,
    });

    return successResponse(
      res,
      200,
      {
        logs: result.logs,
        pagination: {
          page: result.currentPage,
          limit: result.pageSize,
          total: result.totalCount,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        },
      },
      "Audit logs fetched successfully"
    );
  }

  static async getUserAuditLogs(req: AuthRequest, res: Response) {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestError("Invalid userId");
    }

    const page = Math.max(1, toNumber(req.query.page) ?? 1);
    const limit = Math.min(100, Math.max(1, toNumber(req.query.limit) ?? 20));

    const result = await service.getUserAuditLogs(userId, {
      action: typeof req.query.action === "string" ? req.query.action : undefined,
      entity: typeof req.query.entity === "string" ? req.query.entity : undefined,
      entityId: toNumber(req.query.entityId),
      ipAddress:
        typeof req.query.ipAddress === "string" ? req.query.ipAddress : undefined,
      dateFrom: toDate(req.query.dateFrom),
      dateTo: toDate(req.query.dateTo),
    }, {
      skip: (page - 1) * limit,
      take: limit,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    return successResponse(
      res,
      200,
      {
        logs: result.logs,
        pagination: {
          page: result.currentPage,
          limit: result.pageSize,
          total: result.totalCount,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPreviousPage: result.hasPreviousPage,
        },
      },
      "User audit logs fetched successfully"
    );
  }

  static async getAuditSummary(req: AuthRequest, res: Response) {
    const userId = toNumber(req.query.userId);
    const days = Math.max(1, toNumber(req.query.days) ?? 30);

    const summary = await service.getAuditSummary(userId, days);

    return successResponse(
      res,
      200,
      { summary },
      "Audit summary fetched successfully"
    );
  }

  static async logAction(req: AuthRequest, res: Response) {
    const action =
      typeof req.body?.action === "string" ? req.body.action.trim() : "";

    if (!action) {
      throw new BadRequestError("action is required");
    }

    const entity =
      typeof req.body?.entity === "string" ? req.body.entity.trim() : undefined;
    const entityId =
      typeof req.body?.entityId === "number"
        ? req.body.entityId
        : Number.isFinite(Number(req.body?.entityId))
          ? Number(req.body.entityId)
          : undefined;

    const audit = await service.logAction(
      action,
      req.user?.id,
      entity,
      entityId,
      req.body?.details,
      req.ip,
      req.headers["user-agent"]
    );

    return successResponse(res, 201, { audit }, "Action logged successfully");
  }

  static async cleanup(req: AuthRequest, res: Response) {
    const periodRaw =
      typeof req.query.period === "string" ? req.query.period : undefined;
    const period = toCleanupPeriod(periodRaw);

    if (periodRaw && !period) {
      throw new BadRequestError(
        "Invalid period. Use one of: 7d, 15d, 1m, 3m, 6m, 1y (or 7days, 15days, 1month, 3months, 6months, 1year)"
      );
    }

    const days = Math.max(1, toNumber(req.query.days) ?? 30);
    const retention: AuditCleanupRetention = period ?? days;
    const result = await service.cleanupOldLogs(retention);
    const retentionLabel = period
      ? CLEANUP_PERIOD_LABEL[period]
      : `${days} day(s)`;

    return successResponse(
      res,
      200,
      {
        deletedCount: result.count,
      },
      `Audit logs older than ${retentionLabel} were cleaned up`
    );
  }

  static async logLoginSession(req: AuthRequest, res: Response) {
    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
      req.socket.remoteAddress ||
      req.ip;

    const userAgent = req.headers["user-agent"];
    const audit = await service.logAction(
      "LOGIN",
      req.user?.id,
      "User",
      req.user?.id,
      { ip, userAgent },
      ip,
      userAgent
    );

    return successResponse(res, 201, { audit }, "Login session logged successfully");
  }
}
