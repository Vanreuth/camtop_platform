import { ActionType, Prisma } from "@prisma/client";
import { PermissionRepository } from "./permission.repository";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { NotFoundError } from "../../common/errors/notFound.error";
import { AppError } from "../../common/errors/app.error";

type PaginationOptions = {
	page?: number;
	limit?: number;
	skip?: number;
	take?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
};

type PermissionFilters = {
	resource?: string;
	action?: ActionType;
	isActive?: boolean;
	roleId?: number;
	search?: string;
};

export class PermissionService {
	constructor(private permissionRepository = new PermissionRepository()) {}

	async getAllPermissions(options: PaginationOptions = {}, filters: PermissionFilters = {}) {
		const { page, limit, skip, take, sortBy = "resource", sortOrder = "asc" } = options;

		const resolvedLimit =
			typeof take === "number" && Number.isFinite(take)
				? Math.max(1, take)
				: typeof limit === "number" && Number.isFinite(limit)
					? Math.max(1, limit)
					: 10;

		const resolvedSkip =
			typeof skip === "number" && Number.isFinite(skip)
				? Math.max(0, skip)
				: typeof page === "number" && Number.isFinite(page)
					? Math.max(0, (Math.max(1, page) - 1) * resolvedLimit)
					: 0;

		const resolvedPage =
			typeof page === "number" && Number.isFinite(page)
				? Math.max(1, page)
				: Math.floor(resolvedSkip / resolvedLimit) + 1;
		const { resource, action, isActive, roleId, search } = filters;

		const where: any = {};

		if (resource) where.resource = resource;
		if (action) where.action = action;
		if (isActive !== undefined) where.isActive = isActive;
		if (roleId) {
			where.roles = { some: { roleId } };
		}
		if (search) {
			where.OR = [
				{ permissionName: { contains: search, mode: "insensitive" } },
				{ permissionCode: { contains: search, mode: "insensitive" } },
				{ resource: { contains: search, mode: "insensitive" } },
				{ description: { contains: search, mode: "insensitive" } },
			];
		}

		const orderBy = sortBy ? { [sortBy]: sortOrder } : undefined;

		const [permissions, totalCount] = await Promise.all([
			this.permissionRepository.findMany({
				skip: resolvedSkip,
				take: resolvedLimit,
				where,
				orderBy,
				include: {
					roles: {
						include: {
							role: {
								select: {
									id: true,
									roleName: true,
									roleCode: true,
									hierarchyLevel: true,
									isActive: true,
								},
							},
						},
					},
				},
			}),
			this.permissionRepository.count(where),
		]);

		return {
			permissions,
			pagination: {
				page: resolvedPage,
				limit: resolvedLimit,
				total: totalCount,
				totalPages: Math.max(1, Math.ceil(totalCount / resolvedLimit)),
				hasNextPage: resolvedSkip + resolvedLimit < totalCount,
				hasPreviousPage: resolvedPage > 1,
			},
		};
	}

	async getPermissionById(id: number) {
		const permission = await this.permissionRepository.findById(id);
		if (!permission) throw new NotFoundError("Permission not found");
		return permission;
	}

	async createPermission(data: {
		permissionName: string;
		permissionCode: string;
		resource: string;
		action: ActionType;
		description?: string;
	}) {
		if (!Object.values(ActionType).includes(data.action)) {
			throw new BadRequestError(
				`Invalid action type. Must be one of: ${Object.values(ActionType).join(", ")}`
			);
		}

		try {
			return await this.permissionRepository.create({
				permissionName: data.permissionName.trim(),
				permissionCode: data.permissionCode.trim().toLowerCase(),
				resource: data.resource.trim().toLowerCase(),
				action: data.action,
				description: data.description?.trim() || null,
			});
		} catch (err: any) {
			if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
				const target = (err as any).meta?.target?.[0] ?? "field";
				throw new AppError(`Permission with this ${target} already exists`, 409);
			}
			throw err;
		}
	}

	async updatePermission(
		id: number,
		data: {
			permissionName?: string;
			permissionCode?: string;
			resource?: string;
			action?: ActionType;
			description?: string;
			isActive?: boolean;
		}
	) {
		const existing = await this.permissionRepository.findById(id);
		if (!existing) throw new NotFoundError("Permission not found");

		const updateData: any = {};
		if (data.permissionName) updateData.permissionName = data.permissionName.trim();
		if (data.permissionCode) updateData.permissionCode = data.permissionCode.trim().toLowerCase();
		if (data.resource) updateData.resource = data.resource.trim().toLowerCase();
		if (data.action) {
			if (!Object.values(ActionType).includes(data.action)) {
				throw new BadRequestError(
					`Invalid action type. Must be one of: ${Object.values(ActionType).join(", ")}`
				);
			}
			updateData.action = data.action;
		}
		if (data.description !== undefined) updateData.description = data.description?.trim() || null;
		if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

		try {
			return await this.permissionRepository.update(id, updateData);
		} catch (err: any) {
			if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
				const target = (err as any).meta?.target?.[0] ?? "field";
				throw new AppError(`Permission with this ${target} already exists`, 409);
			}
			throw err;
		}
	}

	async deactivatePermission(id: number) {
		const existing = await this.permissionRepository.findById(id);
		if (!existing) throw new NotFoundError("Permission not found");
		if (!existing.isActive) throw new BadRequestError("Permission is already deactivated");
		if (existing.roles.length > 0) {
			throw new BadRequestError(
				`Cannot deactivate permission that is assigned to ${existing.roles.length} role(s).`
			);
		}
		return this.permissionRepository.update(id, { isActive: false });
	}

	async getAvailablePermissionsForRole(
		roleId: number,
		options: PaginationOptions = {},
		filters: PermissionFilters = {}
	) {
		const { page, limit, skip, take, sortBy = "resource", sortOrder = "asc" } = options;

		const resolvedLimit =
			typeof take === "number" && Number.isFinite(take)
				? Math.max(1, take)
				: typeof limit === "number" && Number.isFinite(limit)
					? Math.max(1, limit)
					: 10;

		const resolvedSkip =
			typeof skip === "number" && Number.isFinite(skip)
				? Math.max(0, skip)
				: typeof page === "number" && Number.isFinite(page)
					? Math.max(0, (Math.max(1, page) - 1) * resolvedLimit)
					: 0;

		const resolvedPage =
			typeof page === "number" && Number.isFinite(page)
				? Math.max(1, page)
				: Math.floor(resolvedSkip / resolvedLimit) + 1;
		const { resource, action, isActive, search } = filters;

		const where: any = {
			roles: { none: { roleId } },
		};

		if (resource) where.resource = resource;
		if (action) where.action = action;
		if (isActive !== undefined) where.isActive = isActive;
		if (search) {
			where.OR = [
				{ permissionName: { contains: search, mode: "insensitive" } },
				{ permissionCode: { contains: search, mode: "insensitive" } },
				{ resource: { contains: search, mode: "insensitive" } },
				{ description: { contains: search, mode: "insensitive" } },
			];
		}

		const orderBy = sortBy ? { [sortBy]: sortOrder } : undefined;

		const [permissions, totalCount] = await Promise.all([
			this.permissionRepository.findMany({
				skip: resolvedSkip,
				take: resolvedLimit,
				where,
				orderBy,
				include: {
					roles: {
						include: { role: { select: { id: true, roleName: true, roleCode: true } } },
					},
				},
			}),
			this.permissionRepository.count(where),
		]);

		return {
			permissions,
			pagination: {
				page: resolvedPage,
				limit: resolvedLimit,
				total: totalCount,
				totalPages: Math.max(1, Math.ceil(totalCount / resolvedLimit)),
				hasNextPage: resolvedSkip + resolvedLimit < totalCount,
				hasPreviousPage: resolvedPage > 1,
			},
		};
	}

	async validatePermissionAssignable(roleId: number, permissionId: number, userHierarchyLevel?: number) {
		const role = await this.permissionRepository.findActiveRoleById(roleId);
		if (!role) throw new NotFoundError("Role not found or inactive");

		const permission = await this.permissionRepository.findActivePermissionById(permissionId);
		if (!permission) throw new NotFoundError("Permission not found or inactive");

		if (userHierarchyLevel !== undefined && role.hierarchyLevel < userHierarchyLevel) {
			throw new BadRequestError(
				"Cannot assign permission to a role with higher hierarchy level"
			);
		}

		const existing = await this.permissionRepository.findRolePermission(roleId, permissionId);
		if (existing) throw new BadRequestError("Role already has this permission");

		return { valid: true, roleId, permissionId };
	}

	async assignPermissionToRole(
		data: { roleId: number; permissionId: number; assignedBy: number },
		userHierarchyLevel?: number
	) {
		const role = await this.permissionRepository.findActiveRoleById(data.roleId);
		if (!role) throw new BadRequestError("Role not found or inactive");

		const permission = await this.permissionRepository.findActivePermissionById(data.permissionId);
		if (!permission) throw new BadRequestError("Permission not found or inactive");

		if (userHierarchyLevel !== undefined && role.hierarchyLevel < userHierarchyLevel) {
			throw new BadRequestError(
				"Cannot assign permissions to roles with higher hierarchy level"
			);
		}

		const existing = await this.permissionRepository.findRolePermission(data.roleId, data.permissionId);
		if (existing) throw new BadRequestError("This role already has this permission");

		return this.permissionRepository.upsertRolePermission(data);
	}

	async revokePermissionFromRole(
		roleId: number,
		permissionId: number,
		userMaxHierarchyLevel: number
	) {
		const role = await this.permissionRepository.findRoleById(roleId);
		if (!role) throw new NotFoundError("Role not found");

		if (role.hierarchyLevel < userMaxHierarchyLevel) {
			throw new AppError(
				"Cannot revoke permissions from roles with higher hierarchy level",
				403
			);
		}

		try {
			await this.permissionRepository.deleteRolePermission(roleId, permissionId);
		} catch (err: any) {
			if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
				throw new NotFoundError("Permission assignment not found");
			}
			throw err;
		}

		return { revoked: true };
	}
}

