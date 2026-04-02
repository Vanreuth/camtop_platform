import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authenticate , authorizeRole } from '../../middleware/auth.middleware';
import {ListNotificationsQuerySchema,adminDeleteParamSchema,adminListAllNotificationsQuerySchema,adminSendToPrivilegedUsersBodySchema,adminSendToUserBodySchema,adminUserIdParamSchema,NotificationIdParamSchema, adminSendToAllUsersBodySchema,adminBulkDeleteBodySchema,adminForceDeleteParamSchema,adminPruneBodySchema,adminTypeParamSchema} from "./notification.dto"
import { validate } from "../../middleware/validation.middleware";

const router = Router();
const controller = new NotificationController();

// All routes require authentication
router.use(authenticate);

// user
router.get('/me', validate(ListNotificationsQuerySchema,"query"), controller.getMyNotifications);
router.get('/unread-count', controller.getUnreadCount);
router.patch('/:id/read',validate(NotificationIdParamSchema,"params"), controller.markAsRead);
router.patch('/read-all', controller.markAllAsRead);
router.delete('/:id', validate(NotificationIdParamSchema,"params"), controller.deleteNotification);

// admin
router.use(authorizeRole(2));

router.get(
  "/",
  validate(adminListAllNotificationsQuerySchema,"query"),
  controller.adminGetAllNotifications
);

router.get('/user/:userId', validate(adminUserIdParamSchema,"params"), controller.adminGetUserNotifications);
router.post('/', validate(adminSendToUserBodySchema,"body"), controller.adminCreateNotification);

router.post('/all', validate(adminSendToAllUsersBodySchema,"body"), controller.adminSendAllUsers);

router.post('/privileged', validate(adminSendToPrivilegedUsersBodySchema,"body"), controller.adminSendPrivileged);
router.delete('/user/:userId/notification/:id', validate(adminDeleteParamSchema,"params"), controller.adminDeleteUserNotification);

// Deletion Workflows
// 1. Delete specific notification of a specific user (Existing)
router.delete('/user/:userId/notification/:id', validate(adminDeleteParamSchema, "params"), controller.adminDeleteUserNotification);

// 2. Force Delete ANY single notification (ignores owner) 
router.delete('/force/:id', validate(adminForceDeleteParamSchema, "params"), controller.adminDeleteAny);

// 3. Bulk Delete (Array of IDs) 
router.post('/bulk-delete', validate(adminBulkDeleteBodySchema, "body"), controller.adminDeleteBulk);

// 4. Prune/Cleanup (Delete old data) 
router.post('/prune', validate(adminPruneBodySchema, "body"), controller.adminPruneOld);

// 1. Clear specific user inbox
router.delete(
  '/users/:userId/all', 
  validate(adminUserIdParamSchema, "params"), 
  controller.adminClearUserInbox
);

// 2. Clear all notifications of a specific type
router.delete(
  '/type/:type', 
  validate(adminTypeParamSchema, "params"), 
  controller.adminDeleteByType
);

// 3. Nuke everything (System Reset)
router.delete(
  '/truncate', 
  // Optional: Add authorizeRole(1) here for Super Admin only
  controller.adminTruncate
);

export default router;