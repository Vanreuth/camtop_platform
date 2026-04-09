import type { Request, Response } from "express";
import type { AuthRequest } from "../../common/types/auth.type";
import { UserService } from "./user.service";
import { NotFoundError } from "../../common/errors/notFound.error";
import { ForbiddenError } from "../../common/errors/forbidden.error";
import { successResponse } from "../../common/utils/responseHelper";

const service = new UserService();

const toNumber = (value: unknown): number | undefined => {
	if (typeof value !== "string" || value.trim() === "") return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const toDate = (value: unknown): Date | undefined => {
	if (typeof value !== "string" || value.trim() === "") return undefined;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export class UserController {
	private static buildUserResponse(user: any) {
		return {
			id: user.id,
			email: user.email,
			username: user.username,
			firstName: user.firstName,
			lastName: user.lastName,
			phone: user.phone,
			profilePicture: user.profilePicture,
			bio: user.bio,
			status: user.status,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			roles:
				user.roles?.map((ur: any) => ({
					id: ur.role?.id,
					roleName: ur.role?.roleName,
					roleCode: ur.role?.roleCode,
				})) ?? [],
			permissions:
				user.roles?.flatMap((r: any) =>
					r.role?.permissions?.map((p: any) => p.permission) ?? []
				) ?? [],
		};
	}

	static async getAllUsers(req: Request, res: Response) {
		const filters = {
			status: req.query.status as any,
			role: req.query.role as string,
			search: req.query.search as string,
			createdAfter: req.query.createdAfter
				? new Date(req.query.createdAfter as string)
				: undefined,
			createdBefore: req.query.createdBefore
				? new Date(req.query.createdBefore as string)
				: undefined,
		};

		const pagination = {
			page: Number(req.query.page) || 1,
			limit: Number(req.query.limit) || 10,
			sortBy: (req.query.sortBy as string) || "createdAt",
			sortOrder: (req.query.sortOrder as "asc" | "desc") || "desc",
		};

		const data = await service.findAll(pagination, filters);

		return successResponse(res, 200, { users: data.users }, "Get Users successfully", {
			pagination: data.pagination,
		});
	}

	static async getUserById(req: Request, res: Response) {
		const id = Number(req.params.id);
		const user: any = await service.findById(id);
		if (!user) throw new NotFoundError("User not found");

		return successResponse(res, 200, { user: UserController.buildUserResponse(user) }, "User fetched successfully");
	}

	static async createUser(req: AuthRequest, res: Response) {
		const { roleId, ...userData } = req.body as any;
		const file = (req as any).file as Express.Multer.File | undefined;
		const authenticatedUserId = req.user!.id;

		const newUser = await service.create(
			userData,
			{ assignedBy: authenticatedUserId, roleId: Number(roleId) },
			file
		);

		return successResponse(
			res,
			201,
			{ user: UserController.buildUserResponse(newUser) },
			"User created successfully"
		);
	}

	static async updateUser(req: AuthRequest, res: Response) {
		const id = Number(req.params.id);
		const authenticatedUser = req.user!;
		const file = (req as any).file as Express.Multer.File | undefined;
		const userData = req.body as any;

		if (!authenticatedUser) {
			throw new ForbiddenError("User not authenticated");
		}

		const user = await service.updateUser(id, authenticatedUser, userData, file);

		return successResponse(
			res,
			200,
			{ user: UserController.buildUserResponse(user) },
			"User updated successfully"
		);
	}

	static async deleteUser(req: AuthRequest, res: Response) {
		const id = Number(req.params.id);
		const currentUser = req.user;
		if (!currentUser) throw new ForbiddenError("User not authenticated");

		await service.deleteById(id, currentUser.id);
		return successResponse(res, 200, null, "User status updated to INACTIVE successfully");
	}

	static async reactivateUser(req: AuthRequest, res: Response) {
		const id = Number(req.params.id);
		const currentUser = req.user;
		if (!currentUser) throw new ForbiddenError("User not authenticated");

		await service.reactivateUser(id, currentUser.id);
		return successResponse(res, 200, null, "User reactivated successfully");
	}

	static async updateUserRole(req: AuthRequest, res: Response) {
		const id = Number(req.params.id);
		const currentUser = req.user;
		if (!currentUser) throw new ForbiddenError("User not authenticated");

		const updated = await service.updateUserRole(id, currentUser, Number((req.body as any).roleId));
		if (!updated) throw new NotFoundError("User not found");

		return successResponse(
			res,
			200,
			{ user: UserController.buildUserResponse(updated) },
			"User role updated successfully"
		);
	}

	static async getUserStatistics(req: Request, res: Response) {
		const filters = {
			startDate: req.query.startDate as string | undefined,
			endDate: req.query.endDate as string | undefined,
			roleId: req.query.roleId ? Number(req.query.roleId) : undefined,
		};

		const statistics = await service.getUserStatistics(filters);

		return successResponse(
			res,
			200,
			statistics,
			"User statistics retrieved successfully"
		);
	}

	static async getUserAuditLogs(req: AuthRequest, res: Response) {
		const currentUser = req.user;
		if (!currentUser) throw new ForbiddenError("User not authenticated");

		const userId = Number(req.params.id);
		const targetUser = await service.findById(userId);
		if (!targetUser) throw new NotFoundError("User not found");

		const isSelf = currentUser.id === userId;
		const canReadOthers =
			currentUser.permissions.includes("audit:read") ||
			currentUser.permissions.includes("audit:manage") ||
			currentUser.permissions.includes("user:manage");

		if (!isSelf && !canReadOthers) {
			throw new ForbiddenError("You do not have permission to view this user's audit logs");
		}

		const page = Math.max(1, Number(req.query.page) || 1);
		const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
		const filters = {
			action: typeof req.query.action === "string" ? req.query.action : undefined,
			entity: typeof req.query.entity === "string" ? req.query.entity : undefined,
			entityId: toNumber(req.query.entityId),
			ipAddress: typeof req.query.ipAddress === "string" ? req.query.ipAddress : undefined,
			dateFrom: toDate(req.query.dateFrom),
			dateTo: toDate(req.query.dateTo),
		};

		const data = await service.getAuditLogs(userId, filters, { page, limit });

		return successResponse(
			res,
			200,
			{
				logs: data.logs,
				pagination: {
					page: data.currentPage,
					limit: data.pageSize,
					total: data.totalCount,
					totalPages: data.totalPages,
					hasNextPage: data.hasNextPage,
					hasPreviousPage: data.hasPreviousPage,
				},
			},
			"User audit logs fetched successfully"
		);
	}
}

