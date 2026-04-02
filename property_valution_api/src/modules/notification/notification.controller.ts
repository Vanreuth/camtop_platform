import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
import { NotificationType } from '@prisma/client';
import { logger } from '../../config/logger';
import { AuthRequest } from '../../common/types/auth.type';

const service = new NotificationService();

export class NotificationController {
  private getSingleParamValue(value?: string | string[]): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private parseParamAsInt(value?: string | string[]): number {
    return parseInt(this.getSingleParamValue(value) ?? '', 10);
  }
  
  /**
   * Helper to convert date string to Date object
   */
  private parseDate(dateString?: string, endOfDay: boolean = false): Date | undefined {
    if (!dateString) return undefined;
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return undefined;
      }
      
      if (endOfDay) {
        // Set to end of day: 23:59:59.999
        date.setHours(23, 59, 59, 999);
      } else {
        // Set to start of day: 00:00:00.000
        date.setHours(0, 0, 0, 0);
      }
      
      return date;
    } catch (error) {
      logger.warn({ dateString, error }, 'Failed to parse date');
      return undefined;
    }
  }

  // =========================
  // USER ENDPOINTS
  // =========================

  getMyNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      const { unreadOnly, limit, skip } = req.query;

      const notifications = await service.getUserNotifications(userId, {
        unreadOnly: unreadOnly === 'true',
        limit: limit ? parseInt(limit as string) : undefined,
        skip: skip ? parseInt(skip as string) : undefined,
      });

      const unreadCount = await service.getUnreadCount(userId);

      return res.json({
        success: true,
        data: {
          notifications,
          unreadCount,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getUnreadCount = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      const count = await service.getUnreadCount(userId);

      return res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      const notificationId = this.parseParamAsInt(req.params.id);

      await service.markAsRead(notificationId, userId);

      return res.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      await service.markAllAsRead(userId);

      return res.json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error) {
      next(error);
    }
  };

  deleteNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized' 
        });
      }

      const notificationId = this.parseParamAsInt(req.params.id);

      await service.deleteNotification(notificationId, userId);

      return res.json({
        success: true,
        message: 'Notification deleted',
      });
    } catch (error) {
      next(error);
    }
  };

  // =========================
  // ADMIN ENDPOINTS
  // =========================

  adminGetAllNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, type, isRead, dateFrom, dateTo, limit, skip } = req.query;

      // ✅ FIX: Convert date strings to Date objects
      const filters = {
        userId: userId ? parseInt(userId as string) : undefined,
        type: type as NotificationType | undefined,
        isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
        dateFrom: this.parseDate(dateFrom as string, false), // Start of day
        dateTo: this.parseDate(dateTo as string, true),       // End of day
        limit: limit ? parseInt(limit as string) : undefined,
        skip: skip ? parseInt(skip as string) : undefined,
      };

      const result = await service.adminGetAllNotifications(filters);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  adminGetUserNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.parseParamAsInt(req.params.userId);
      const { unreadOnly, limit, skip } = req.query;

      const notifications = await service.getUserNotifications(userId, {
        unreadOnly: unreadOnly === 'true',
        limit: limit ? parseInt(limit as string) : undefined,
        skip: skip ? parseInt(skip as string) : undefined,
      });

      const unreadCount = await service.getUnreadCount(userId);

      return res.json({
        success: true,
        data: {
          notifications,
          unreadCount,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  adminCreateNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { userId, type, title, message, entityType, entityId, actionUrl } = req.body;
      const createdById = req.user?.id;

      const notification = await service.createNotification({
        userId,
        createdById,
        type,
        title,
        message,
        entityType,
        entityId,
        actionUrl,
      });

      return res.status(201).json({
        success: true,
        data: { notification },
      });
    } catch (error) {
      next(error);
    }
  };

  adminSendAllUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { type, title, message, entityType, entityId, actionUrl } = req.body;
      const createdById = req.user?.id;

      const result = await service.sendToAllUsers({
        type,
        title,
        message,
        entityType,
        entityId,
        actionUrl,
      }, createdById);

      return res.json({
        success: true,
        data: result,
        message: `Sent to ${result.count} users`,
      });
    } catch (error) {
      next(error);
    }
  };

  adminSendPrivileged = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { type, title, message, entityType, entityId, actionUrl } = req.body;
      const createdById = req.user?.id;

      const result = await service.sendToPrivilegedUsers({
        type,
        title,
        message,
        entityType,
        entityId,
        actionUrl,
      }, createdById);

      return res.json({
        success: true,
        data: { count: result.result.count },
        message: `Sent to ${result.result.count} privileged users`,
      });
    } catch (error) {
      next(error);
    }
  };

  adminDeleteUserNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.parseParamAsInt(req.params.userId);
      const notificationId = this.parseParamAsInt(req.params.id);

      await service.deleteNotification(notificationId, userId);

      return res.json({
        success: true,
        message: 'Notification deleted',
      });
    } catch (error) {
      next(error);
    }
  };

  // =========================
  // ADMIN DELETE WORKFLOWS
  // =========================

  adminDeleteAny = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notificationId = this.parseParamAsInt(req.params.id);

      const result = await service.adminDeleteNotification(notificationId);

      return res.json({
        success: true,
        data: { count: result.count },
        message: 'Notification force deleted',
      });
    } catch (error) {
      next(error);
    }
  };

  adminDeleteBulk = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids)) {
        return res.status(400).json({
          success: false,
          message: 'ids must be an array',
        });
      }

      const result = await service.adminDeleteMany(ids);

      return res.json({
        success: true,
        data: { count: result.count },
        message: `Deleted ${result.count} notifications`,
      });
    } catch (error) {
      next(error);
    }
  };

  adminPruneOld = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { daysOld, onlyRead } = req.body;

      const result = await service.adminPruneNotifications(
        daysOld || 30,
        onlyRead || false
      );

      return res.json({
        success: true,
        data: { count: result.count },
        message: `Pruned ${result.count} old notifications`,
      });
    } catch (error) {
      next(error);
    }
  };

  adminClearUserInbox = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = this.parseParamAsInt(req.params.userId);

      const result = await service.adminDeleteAllForUser(userId);

      return res.json({
        success: true,
        data: { count: result.count },
        message: `Cleared ${result.count} notifications for user ${userId}`,
      });
    } catch (error) {
      next(error);
    }
  };

  adminDeleteByType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = req.params.type as NotificationType;

      const result = await service.adminDeleteByType(type);

      return res.json({
        success: true,
        data: { count: result.count },
        message: `Deleted ${result.count} notifications of type ${type}`,
      });
    } catch (error) {
      next(error);
    }
  };

  adminTruncate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.adminTruncateAll();

      return res.json({
        success: true,
        data: { count: result.count },
        message: `Deleted all ${result.count} notifications (system reset)`,
      });
    } catch (error) {
      next(error);
    }
  };
}
