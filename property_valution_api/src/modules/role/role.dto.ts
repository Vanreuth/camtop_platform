import { z } from "zod";


export const getRolesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    // backward-compatible support
    skip: z.coerce.number().int().min(0).optional(),
    take: z.coerce.number().int().min(1).max(100).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    role: z.string().optional(),
    search: z.string().optional(),
    createdAfter: z.string().optional(),
    createdBefore: z.string().optional(),
    hierarchyLevel: z.coerce.number().int().min(1).optional(),
    hasUsers: z.coerce.boolean().optional(),
    hasPermissions: z.coerce.boolean().optional(),
});

export const roleIdParamSchema = z.object({
    id: z.coerce.number().int().min(1, "Role ID must be a positive integer"),
});

const roleNameSchema = z
.string()
.min(3 ,"Role name must be at least 3 characters long")
.max(30 ,"Role name must be at most 30 characters long")
.regex(/^[a-zA-Z0-9_ ]+$/, "Role name can only contain letters, numbers, spaces, and underscores");
  
const roleCodeSchema = z
.string()
.min(3,"Role code must be at least 3 characters long")
.max(30,"Role code must be at most 30 characters long")
.regex(/^[A-Z]+$/, "Role code can only contain uppercase letters");
const hierarchyLevelSchema = z
.number()
.int()
.min(1, "Hierarchy level must be a positive integer");

export const createRoleSchema = z.object({
  roleName: roleNameSchema,
  roleCode: roleCodeSchema,
  hierarchyLevel: hierarchyLevelSchema,
  description: z.string().max(255).optional(),
});

export const updateRoleSchema = createRoleSchema.partial();

export const assignRolesSchema = z.object({
  userId: z.coerce.number().int().positive(),
  roleIds: z.array(z.coerce.number().int().positive()).min(1),
});


export type GetRolesQueryDto = z.infer<typeof getRolesQuerySchema>;
export type RoleIdParamDto = z.infer<typeof roleIdParamSchema>;
export type AssignRolesDto = z.infer<typeof assignRolesSchema>;
export type CreateRoleDto = z.infer<typeof createRoleSchema>;
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
