import { z } from "zod";
import { AccountStatus } from "@prisma/client";

export const userIdParamSchema = z.object({
	id: z.coerce.number().int().min(1, "User ID must be a positive integer"),
});

const emailSchema = z.string().email().toLowerCase().trim().max(255);

const usernameSchema = z
	.string()
	.min(3)
	.max(30)
	.regex(
		/^[a-zA-Z0-9_]+$/,
		"Username can only contain letters, numbers, and underscores"
	);

const nameSchema = z
	.string()
	.min(1)
	.max(50)
	.transform((val) => val.trim());

const passwordSchema = z.string().min(6).max(30);

export const createUserBodySchema = z.object({
	email: emailSchema,
	username: usernameSchema,
	password: passwordSchema,
	firstName: nameSchema,
	lastName: nameSchema,
	phone: z.string().max(30).optional(),
	bio: z.string().max(2000).optional(),
	status: z.nativeEnum(AccountStatus).optional(),
	roleId: z.coerce.number().int().min(1),
});

export const updateUserBodySchema = z
	.object({
		email: emailSchema.optional(),
		username: usernameSchema.optional(),
		firstName: nameSchema.optional(),
		lastName: nameSchema.optional(),
		phone: z.string().max(30).optional(),
		bio: z.string().max(2000).optional(),
		status: z.nativeEnum(AccountStatus).optional(),
		roleId: z.coerce.number().int().min(1).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "Request body cannot be empty",
	});

export const updateUserRoleBodySchema = z
	.object({
		roleId: z.coerce.number().int().min(1, "roleId is required"),
	})
	.strict();

export const listUsersQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).optional(),
	sortBy: z.string().optional(),
	sortOrder: z.enum(["asc", "desc"]).optional(),
	status: z.nativeEnum(AccountStatus).optional(),
	role: z.string().optional(),
	search: z.string().optional(),
	createdAfter: z.coerce.date().optional(),
	createdBefore: z.coerce.date().optional(),
});

export type CreateUserBodyDto = z.infer<typeof createUserBodySchema>;
export type UpdateUserBodyDto = z.infer<typeof updateUserBodySchema>;
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserRoleBodyDto = z.infer<typeof updateUserRoleBodySchema>;
