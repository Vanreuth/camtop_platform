import { Router } from "express";
import { UserController } from "./user.controller";
import { authenticate, authorizeAny, superAdminOnly } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { upload } from "../../middleware/upload.middleware";
import {
	createUserBodySchema,
	listUsersQuerySchema,
	updateUserRoleBodySchema,
	updateUserBodySchema,
	userIdParamSchema,
} from "./user.dto";

export const userRoutes = Router();

// protect all user routes
userRoutes.use(authenticate);
userRoutes.get(
	"/statistics",
	authorizeAny(3, ["dashboard:read"]),
	UserController.getUserStatistics
);

userRoutes.get(
	"/",
	authorizeAny(2, ["user:read"]),
	validate(listUsersQuerySchema, "query"),
	UserController.getAllUsers
);

userRoutes.get(
	"/:id/audit-logs",
	validate(userIdParamSchema, "params"),
	UserController.getUserAuditLogs
);

userRoutes.get(
	"/:id",
	authorizeAny(2, ["user:read", "user:manage"]),
	validate(userIdParamSchema, "params"),
	UserController.getUserById
);

userRoutes.post(
	"/",
	authorizeAny(2, ["user:manage", "user:create"]),
	upload.single("profilePicture"),
	validate(createUserBodySchema),
	UserController.createUser
);

userRoutes.put(
	"/:id",
	authorizeAny(2, ["user:manage", "user:update"]),
	validate(userIdParamSchema, "params"),
	upload.single("profilePicture"),
	validate(updateUserBodySchema),
	UserController.updateUser
);

userRoutes.delete(
	"/:id",
	superAdminOnly(),
	validate(userIdParamSchema, "params"),
	UserController.deleteUser
);

userRoutes.put(
	"/reactivate/:id",
	authorizeAny(2, ["user:update", "user:manage"]),
	validate(userIdParamSchema, "params"),
	UserController.reactivateUser
);

userRoutes.patch(
	"/:id/role",
	authorizeAny(2, ["user:manage"]),
	validate(userIdParamSchema, "params"),
	validate(updateUserRoleBodySchema),
	UserController.updateUserRole
);

