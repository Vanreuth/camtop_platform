import { prisma } from "../../db/prisma";
import { NotificationType, Prisma } from "@prisma/client";
import { logger } from "../../config/logger";

type CreateNotificationInput = {
  userId: number;
  createdById?: number | null;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
  actionUrl?: string;
};

type NotificationPayload = {
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
  actionUrl?: string;
};

function buildActionUrl(entityType?: string, entityId?: number) {
  if (!entityType || !entityId) return undefined;

  switch (entityType) {
    case "PROPERTY_VALUATION":
    case "VALUATION":
      return `/dashboard/propertyValuation/${entityId}`;
    case "INDICATIVE_VALUATION":
    case "PROPERTY_INDICATIVE_VALUATION":
      return `/dashboard/propertyIndicativeValuation/${entityId}`;
    case "PROPERTY":
      return `/dashboard/property/${entityId}`;
    default:
      return undefined;
  }
}

/**
 * Entity is valid ONLY if both exist
 * - if entity valid => actionUrl can be built from entity
 * - if not => entity fields removed, actionUrl only allowed if provided explicitly
 */
function normalizePayload(payload: NotificationPayload): NotificationPayload {
  const title = payload.title?.trim() ?? "";
  const message = payload.message?.trim() ?? "";
  const entityType = payload.entityType?.trim();

  const hasEntityType = !!entityType;
  const hasEntityId = Number.isInteger(payload.entityId) && (payload.entityId as number) > 0;

  if (hasEntityType && hasEntityId) {
    const actionUrl =
      payload.actionUrl?.trim() || buildActionUrl(entityType, payload.entityId);

    return {
      type: payload.type,
      title,
      message,
      entityType,
      entityId: payload.entityId,
      actionUrl: actionUrl || undefined,
    };
  }

  // GLOBAL (no entity)
  return {
    type: payload.type,
    title,
    message,
    entityType: undefined,
    entityId: undefined,
    actionUrl: payload.actionUrl?.trim() || undefined,
  };
}

function normalizeBroadcastPayload(payload: NotificationPayload): NotificationPayload {
  return {
    type: payload.type,
    title: payload.title.trim(),
    message: payload.message.trim(),
    entityType: undefined,
    entityId: undefined,
    actionUrl: payload.actionUrl?.trim() || undefined,
  };
}

export class NotificationService {
  private readonly userSummarySelect = {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      profilePicture: true,
      roles: {
        select: {
          role: {
            select: {
              roleName: true,
              roleCode: true,
              hierarchyLevel: true,
            },
          },
        },
      },
    },
  } as const;

  // =========================
  // CREATE (Single)
  // =========================
  async createNotification(data: CreateNotificationInput) {
    try {
      const normalized = normalizePayload({
        type: data.type,
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
        actionUrl: data.actionUrl,
      });

      return await prisma.notification.create({
        data: {
          userId: data.userId,
          createdBy: data.createdById ?? null,
          type: normalized.type,
          title: normalized.title,
          message: normalized.message,
          entityType: normalized.entityType,
          entityId: normalized.entityId,
          actionUrl: normalized.actionUrl,
          isRead: false,
          readAt: null,
        },
      });
    } catch (error) {
      logger.error({ error, data }, "Failed to create notification");
      throw error;
    }
  }

  // =========================
  // CREATE MANY (Array)
  // =========================
  async createManyNotifications(notifications: CreateNotificationInput[]) {
    try {
      const safe = notifications.slice(0, 2000); // protect DB
      const chunkSize = 500;

      let totalCount = 0;

      for (let i = 0; i < safe.length; i += chunkSize) {
        const chunk = safe.slice(i, i + chunkSize);

        const result = await prisma.notification.createMany({
          data: chunk.map((n) => ({
            userId: n.userId,
            createdBy: n.createdById ?? null,
            type: n.type,
            title: n.title,
            message: n.message,
            entityType: n.entityType,
            entityId: n.entityId,
            actionUrl: n.actionUrl ?? buildActionUrl(n.entityType, n.entityId),
            isRead: false,
            readAt: null,
          })),
          skipDuplicates: true,
        });

        totalCount += result.count;
      }

      return { count: totalCount };
    } catch (error) {
      logger.error({ error }, "Failed to create many notifications");
      throw error;
    }
  }

  // =========================
  // READ (User notifications)
  // =========================
  async getUserNotifications(
    userId: number,
    options?: { unreadOnly?: boolean; limit?: number; skip?: number }
  ) {
    const unreadOnly = options?.unreadOnly ?? false;
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    const skip = Math.max(0, options?.skip ?? 0);

    return prisma.notification.findMany({
      where: { userId, ...(unreadOnly && { isRead: false }) },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
      include: {
        user: this.userSummarySelect,
        createdByUser: this.userSummarySelect,
      },
    });
  }

  async getUnreadCount(userId: number) {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  // =========================
  // UPDATE
  // =========================
  async markAsRead(notificationId: number, userId: number) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: number) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // =========================
  // DELETE
  // =========================
  async deleteNotification(notificationId: number, userId: number) {
    return prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  // =========================
  // ADMIN HELPERS
  // =========================

  async getAllActiveUserIds(): Promise<number[]> {
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE" }, 
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  /**
   * Core sender: send payload to a list of userIds (chunked)
   */
   async sendToUserIds(
    userIds: number[],
    payload: NotificationPayload,
    createdById?: number | null
  ) {
    const ids = Array.from(new Set(userIds)).slice(0, 50_000);
    if (!ids.length) return { count: 0 };

    const chunkSize = 500;
    let total = 0;

    const normalized = normalizePayload(payload);

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);

      const result = await prisma.notification.createMany({
        data: chunk.map((userId) => ({
          userId,
          createdBy: createdById ?? null,
          type: normalized.type,
          title: normalized.title,
          message: normalized.message,
          entityType: normalized.entityType,
          entityId: normalized.entityId,
          actionUrl: normalized.actionUrl,
          isRead: false,
          readAt: null,
        })),
      });

      total += result.count;
    }

    return { count: total };
  }

  /**
   * ✅ Send to ALL active users (no userId input needed)
   */
  async sendToAllUsers(payload: NotificationPayload, createdById?: number | null) {
    const userIds = await this.getAllActiveUserIds();
    return this.sendToUserIds(
      userIds,
      normalizeBroadcastPayload(payload),
      createdById
    );
  }

  /**
   * Privileged users (role hierarchyLevel <= 2, isActive true)
   */
  async getPrivilegedUsers(): Promise<number[]> {
    try {
      const users = await prisma.userRole.findMany({
        where: {
          role: {
            hierarchyLevel: { lte: 2 },
            isActive: true,
          },
        },
        select: { userId: true },
        distinct: ["userId"],
      });

      return users.map((u) => u.userId);
    } catch (error) {
      logger.error({ error }, "Failed to get privileged users");
      return [];
    }
  }

  /**
   * ✅ Send to privileged users
   */
  async sendToPrivilegedUsers(
    payload: NotificationPayload,
    createdById?: number | null
  ) {
    const userIds = await this.getPrivilegedUsers();
    const result = await this.sendToUserIds(
      userIds,
      normalizeBroadcastPayload(payload),
      createdById
    );
    return { result, userIds };
  }

  // =========================
  // ADMIN GET ALL
  // =========================
  async adminGetAllNotifications(filters: {
    userId?: number;
    type?: NotificationType;
    isRead?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    skip?: number;
  }) {
    const where: Prisma.NotificationWhereInput = {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(typeof filters.isRead === "boolean" ? { isRead: filters.isRead } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            createdAt: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
    };

    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
    const skip = Math.max(0, filters.skip ?? 0);

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        include: {
          user: this.userSummarySelect,
          createdByUser: this.userSummarySelect,
        },
      }),
      prisma.notification.count({ where }),
    ]);

    return { items, total, limit, skip };
  }

  // =========================
  // ADMIN DELETE WORKFLOW
  // =========================

  /**
   * Admin: Delete ANY single notification by ID (ignores ownership)
   */
  async adminDeleteNotification(notificationId: number) {
    // Using deleteMany prevents error P2025 if record doesn't exist
    return prisma.notification.deleteMany({
      where: { id: notificationId },
    });
  }

  /**
   * Admin: Bulk delete multiple notifications by ID
   */
  async adminDeleteMany(notificationIds: number[]) {
    if (!notificationIds.length) return { count: 0 };

    return prisma.notification.deleteMany({
      where: {
        id: { in: notificationIds },
      },
    });
  }

  /**
   * Admin: Maintenance Workflow
   * Delete notifications older than X days to clean up the database.
   * Can optionally filter to only delete 'read' notifications.
   */
  async adminPruneNotifications(daysOld: number, onlyRead: boolean = false) {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysOld);

    return prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: dateThreshold,
        },
        ...(onlyRead && { isRead: true }),
      },
    });
  }

  /**
   * Admin: Delete all notifications for a specific user
   * Useful when banning a user or resetting their data
   */
  async adminDeleteAllForUser(userId: number) {
    return prisma.notification.deleteMany({
      where: { userId },
    });
  }

  /**
   * Admin: Delete ALL notifications of a specific type
   * Use case: Cleaning up old 'SYSTEM_ANNOUNCEMENT' or 'PROMOTIONAL'
   */
  async adminDeleteByType(type: NotificationType) {
    return prisma.notification.deleteMany({
      where: { type },
    });
  }

  /**
   * Admin: Delete ALL notifications in the database
   * Use case: System reset (Dev/Staging) or major cleanup
   */
  async adminTruncateAll() {
    return prisma.notification.deleteMany({});
  }
}
