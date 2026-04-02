import { Router } from "express";
import { PermissionController } from "./permission.controller";
import { authenticate, authorize, authorizeAny, superAdminOnly } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
	assignPermissionSchema,
	createPermissionSchema,
	permissionIdParamSchema,
	permissionRoleParamsSchema,
	updatePermissionSchema,
} from "./permission.dto";

export const permissionRoutes = Router();

// protect all permission routes
permissionRoutes.use(authenticate);

// list permissions
permissionRoutes.get(
	"/",
	authorizeAny(1, ["permission:manage", "permission:read"]),
	PermissionController.getAll
);

// permissions not yet assigned to a role
permissionRoutes.get(
	"/available",
	authorize(1, ["permission:manage"]),
	PermissionController.getAvailableForRole
);

// validate if permission can be assigned
permissionRoutes.get(
	"/validate",
	authorize(1, ["permission:manage"]),
	PermissionController.validateForRole
);

// get by id
permissionRoutes.get(
	"/:id",
	authorize(1, ["permission:manage"]),
	validate(permissionIdParamSchema, "params"),
	PermissionController.getById
);

// create
permissionRoutes.post(
	"/",
	superAdminOnly(),
	validate(createPermissionSchema),
	PermissionController.create
);

// update
permissionRoutes.put(
	"/:id",
	superAdminOnly(),
	validate(permissionIdParamSchema, "params"),
	validate(updatePermissionSchema),
	PermissionController.update
);

// deactivate
permissionRoutes.delete(
	"/:id",
	superAdminOnly(),
	validate(permissionIdParamSchema, "params"),
	PermissionController.deactivate
);

// assign permission to role
permissionRoutes.post(
	"/roles",
	superAdminOnly(),
	validate(assignPermissionSchema),
	PermissionController.assignToRole
);

// revoke permission from role
permissionRoutes.delete(
	"/:permissionId/roles/:roleId",
	superAdminOnly(),
	validate(permissionRoleParamsSchema, "params"),
	PermissionController.revokeFromRole
);

