
import { z } from "zod";

export const createUserSchema = z.object({
	username: z.string().min(1),
	email: z.string().email(),
	password: z.string().min(8),
	firstName: z.string().min(1),
	lastName: z.string().min(1),
	phone: z.string().optional(),
	status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
	roleId: z.number(),
	assignedBy: z.number().optional(),
});

export const updateUserSchema = z.object({
	username: z.string().optional(),
	email: z.string().email().optional(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	phone: z.string().optional(),
	status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
	roleId: z.number().optional(),
	profilePicture: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

