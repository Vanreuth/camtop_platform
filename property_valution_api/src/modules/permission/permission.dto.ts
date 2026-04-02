import { z } from "zod";
import { ActionType } from "@prisma/client";

export const permissionIdParamSchema = z.object({
	id: z.coerce.number().int().min(1, "Permission ID must be a positive integer"),
});

const permissionNameSchema = z
	.string()
	.min(2, "Permission name must be at least 2 characters long")
	.max(50, "Permission name must be at most 50 characters long");

const permissionCodeSchema = z
	.string()
	.min(3, "Permission code must be at least 3 characters long")
	.max(50, "Permission code must be at most 50 characters long");

const resourceSchema = z
	.string()
	.min(2, "Resource must be at least 2 characters long")
	.max(50, "Resource must be at most 50 characters long");

export const createPermissionSchema = z.object({
	permissionName: permissionNameSchema,
	permissionCode: permissionCodeSchema,
	resource: resourceSchema,
	action: z.nativeEnum(ActionType),
	description: z.string().max(1000).optional(),
});

export const updatePermissionSchema = createPermissionSchema
	.partial()
	.extend({
		isActive: z.coerce.boolean().optional(),
	});

export const assignPermissionSchema = z.object({
	roleId: z.coerce.number().int().min(1),
	permissionId: z.coerce.number().int().min(1),
});

export const permissionRoleParamsSchema = z.object({
	permissionId: z.coerce.number().int().min(1),
	roleId: z.coerce.number().int().min(1),
});

export const listPermissionsQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	sortBy: z.string().optional(),
	sortOrder: z.enum(["asc", "desc"]).optional(),
	resource: z.string().optional(),
	action: z.nativeEnum(ActionType).optional(),
	isActive: z.coerce.boolean().optional(),
	roleId: z.coerce.number().int().min(1).optional(),
	search: z.string().optional(),
});

export const availablePermissionsQuerySchema = z.object({
	roleId: z.coerce.number().int().min(1),
	page: z.coerce.number().int().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	sortBy: z.string().optional(),
	sortOrder: z.enum(["asc", "desc"]).optional(),
	resource: z.string().optional(),
	action: z.nativeEnum(ActionType).optional(),
	isActive: z.coerce.boolean().optional(),
	search: z.string().optional(),
});

export const validatePermissionQuerySchema = z.object({
	roleId: z.coerce.number().int().min(1),
	permissionId: z.coerce.number().int().min(1),
});

export type CreatePermissionDto = z.infer<typeof createPermissionSchema>;
export type UpdatePermissionDto = z.infer<typeof updatePermissionSchema>;
export type AssignPermissionDto = z.infer<typeof assignPermissionSchema>;
