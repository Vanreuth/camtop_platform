import { Prisma } from "@prisma/client";
import { AuditRepository } from "./audit.respository";
import {
  AuditCleanupPeriod,
  AuditCleanupRetention,
  AuditFilters,
  AuditLogResult,
  AuditPaginationOptions,
  AuditSummaryResult,
  CreateAuditLogInput,
} from "./audit.type";

export class AuditService {
  constructor(private readonly repo = new AuditRepository()) {}
  private static readonly CLEANUP_PERIOD_DAYS: Record<AuditCleanupPeriod, number> =
    {
      "7d": 7,
      "15d": 15,
      "1m": 30,
      "3m": 90,
      "6m": 180,
      "1y": 365,
    };

  private clampTake(take = 20) {
    return Math.min(Math.max(take, 1), 100);
  }

  private resolveSortBy(sortBy: string = "createdAt") {
    const allowed = ["createdAt", "action", "entity", "userId"] as const;
    return allowed.includes(sortBy as (typeof allowed)[number])
      ? (sortBy as (typeof allowed)[number])
      : "createdAt";
  }

  private resolveCleanupDays(retention: AuditCleanupRetention): number {
    if (typeof retention === "number") {
      return Math.max(retention, 1);
    }

    return AuditService.CLEANUP_PERIOD_DAYS[retention];
  }

  async getAuditLogs(
    filters: AuditFilters = {},
    pagination: AuditPaginationOptions = {}
  ): Promise<AuditLogResult> {
    const skip = Math.max(pagination.skip ?? 0, 0);
    const take = this.clampTake(pagination.take);
    const sortBy = this.resolveSortBy(pagination.sortBy);
    const sortOrder = pagination.sortOrder === "asc" ? "asc" : "desc";

    const where: Prisma.AuditLogWhereInput = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) {
      where.action = { contains: filters.action, mode: "insensitive" };
    }
    if (filters.entity) {
      where.entity = { contains: filters.entity, mode: "insensitive" };
    }
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.ipAddress) {
      where.ipAddress = { contains: filters.ipAddress, mode: "insensitive" };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};

      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }

      if (filters.dateTo) {
        const endOfDay = new Date(filters.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        where.createdAt.lte = endOfDay;
      }
    }

    const [totalCount, logs] = await Promise.all([
      this.repo.count(where),
      this.repo.findMany({
        skip,
        take,
        where,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / take));
    const currentPage = Math.floor(skip / take) + 1;

    return {
      logs,
      totalCount,
      totalPages,
      currentPage,
      pageSize: take,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    };
  }

  async getUserAuditLogs(
    userId: number,
    pagination: AuditPaginationOptions = {}
  ): Promise<AuditLogResult> {
    return this.getAuditLogs({ userId }, pagination);
  }

  async getAuditSummary(
    userId?: number,
    days = 30
  ): Promise<AuditSummaryResult> {
    const safeDays = Math.min(Math.max(days, 1), 365);
    const from = new Date();
    from.setDate(from.getDate() - safeDays);

    const where: Prisma.AuditLogWhereInput = {
      createdAt: { gte: from },
      ...(userId ? { userId } : {}),
    };

    const [actionSummary, entitySummary, recentActivity, dailyActivity] =
      await Promise.all([
        this.repo.groupByAction(where),
        this.repo.groupByEntity(where),
        this.repo.getRecentActivity(userId ? { userId } : {}),
        this.repo.groupByCreatedAt(where),
      ]);

    const dailyStats = dailyActivity.reduce<Record<string, number>>(
      (acc, row) => {
        const key = row.createdAt.toISOString().split("T")[0];
        acc[key] = (acc[key] ?? 0) + row._count.id;
        return acc;
      },
      {}
    );

    return {
      actionSummary: actionSummary.map((item) => ({
        action: item.action,
        count: item._count.action,
      })),
      entitySummary: entitySummary.map((item) => ({
        entity: item.entity ?? "Unknown",
        count: item._count.entity,
      })),
      recentActivity,
      dailyStats,
      period: {
        days: safeDays,
        from: from.toISOString(),
        to: new Date().toISOString(),
      },
    };
  }

  async createAuditLog(input: CreateAuditLogInput) {
    try {
      return await this.repo.create({
        action: input.action,
        userId: input.userId,
        entity: input.entity,
        entityId: input.entityId,
        details: input.details,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
    } catch (error) {
      console.error("Failed to log action:", error);
      return null;
    }
  }

  async logAction(
    action: string,
    userId?: number,
    entity?: string,
    entityId?: number,
    details?: Prisma.InputJsonValue,
    ipAddress?: string,
    userAgent?: string
  ) {
    return this.createAuditLog({
      action,
      userId,
      entity,
      entityId,
      details,
      ipAddress,
      userAgent,
    });
  }

  async cleanupOldLogs(retention: AuditCleanupRetention = 365) {
    const safeDays = this.resolveCleanupDays(retention);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - safeDays);

    return this.repo.deleteMany({
      createdAt: { lt: cutoffDate },
    });
  }
}
