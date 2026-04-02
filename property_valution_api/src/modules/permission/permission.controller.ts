import type { Request, Response } from "express";
import type { AuthRequest } from "../../common/types/auth.type";
import { PermissionService } from "./permission.service";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { ForbiddenError } from "../../common/errors/forbidden.error";
import { successResponse } from "../../common/utils/responseHelper";

const service = new PermissionService();

export class PermissionController {
	static async getAll(req: Request, res: Response) {
		const pageNum = Number(req.query.page ?? 1);
		const limitNum = Number(req.query.limit ?? 10);
		const skip = (pageNum - 1) * limitNum;

		const result = await service.getAllPermissions(
			{
				skip,
				take: limitNum,
				sortBy: String(req.query.sortBy ?? "resource"),
				sortOrder: (String(req.query.sortOrder ?? "asc") as "asc" | "desc"),
			},
			{
				resource: req.query.resource ? String(req.query.resource) : undefined,
				action: req.query.action ? (req.query.action as any) : undefined,
				isActive:
					req.query.isActive !== undefined
						? String(req.query.isActive) === "true"
						: undefined,
				roleId: req.query.roleId ? Number(req.query.roleId) : undefined,
				search: req.query.search ? String(req.query.search) : undefined,
			}
		);

		return successResponse(
			res,
			200,
			{ permissions: result.permissions },
			"Get Permissions successfully",
			{ pagination: result.pagination }
		);
	}

	static async getById(req: Request, res: Response) {
		const id = Number(req.params.id);
		if (!id || Number.isNaN(id)) throw new BadRequestError("Valid permission ID is required");
		const permission = await service.getPermissionById(id);
		return successResponse(res, 200, { permission }, "Permission fetched successfully");
	}

	static async create(req: Request, res: Response) {
		const created = await service.createPermission(req.body);
		return successResponse(res, 201, { permission: created }, "Permission created successfully");
	}

	static async update(req: Request, res: Response) {
		const id = Number(req.params.id);
		if (!id || Number.isNaN(id)) throw new BadRequestError("Invalid permission ID");

		const updated = await service.updatePermission(id, req.body);
		return successResponse(res, 200, { permission: updated }, "Permission updated successfully");
	}

	static async deactivate(req: Request, res: Response) {
		const id = Number(req.params.id);
		if (!id || Number.isNaN(id)) throw new BadRequestError("Invalid permission ID");
		const permission = await service.deactivatePermission(id);
		return successResponse(
			res,
			200,
			{ permission },
			"Permission deactivated successfully"
		);
	}

	static async assignToRole(req: AuthRequest, res: Response) {
		if (!req.user) throw new ForbiddenError("User not authenticated");
		const roleId = Number(req.body.roleId);
		const permissionId = Number(req.body.permissionId);
		if (!roleId || !permissionId || Number.isNaN(roleId) || Number.isNaN(permissionId)) {
			throw new BadRequestError("roleId and permissionId are required");
		}

		const userHierarchyLevel = req.user?.roles?.[0]?.hierarchyLevel ?? 99;
		const result = await service.assignPermissionToRole(
			{ roleId, permissionId, assignedBy: req.user!.id },
			userHierarchyLevel
		);

		return successResponse(
			res,
			200,
			{ assignment: result },
			"Permission assigned to role successfully"
		);
	}

	static async getAvailableForRole(req: Request, res: Response) {
		const roleId = Number(req.query.roleId);
		if (!roleId || Number.isNaN(roleId)) throw new BadRequestError("roleId query parameter is required");

		const pageNum = Number(req.query.page ?? 1);
		const limitNum = Number(req.query.limit ?? 10);
		const skip = (pageNum - 1) * limitNum;

		const result = await service.getAvailablePermissionsForRole(
			roleId,
			{
				skip,
				take: limitNum,
				sortBy: String(req.query.sortBy ?? "resource"),
				sortOrder: (String(req.query.sortOrder ?? "asc") as "asc" | "desc"),
			},
			{
				resource: req.query.resource ? String(req.query.resource) : undefined,
				action: req.query.action ? (req.query.action as any) : undefined,
				isActive:
					req.query.isActive !== undefined
						? String(req.query.isActive) === "true"
						: undefined,
				search: req.query.search ? String(req.query.search) : undefined,
			}
		);

		return successResponse(
			res,
			200,
			{ permissions: result.permissions },
			"Get Available Permissions successfully",
			{ pagination: result.pagination }
		);
	}

	static async validateForRole(req: AuthRequest, res: Response) {
		if (!req.user) throw new ForbiddenError("User not authenticated");
		const roleId = Number(req.query.roleId);
		const permissionId = Number(req.query.permissionId);
		if (!roleId || !permissionId || Number.isNaN(roleId) || Number.isNaN(permissionId)) {
			throw new BadRequestError("roleId and permissionId query parameters are required");
		}

		const userHierarchyLevel = req.user?.roles?.[0]?.hierarchyLevel ?? 99;
		const result = await service.validatePermissionAssignable(roleId, permissionId, userHierarchyLevel);
		return successResponse(res, 200, { result }, "Validation successful");
	}

	static async revokeFromRole(req: AuthRequest, res: Response) {
		if (!req.user) throw new ForbiddenError("User not authenticated");
		const roleId = Number(req.params.roleId);
		const permissionId = Number(req.params.permissionId);
		if (!roleId || !permissionId || Number.isNaN(roleId) || Number.isNaN(permissionId)) {
			throw new BadRequestError("Invalid permissionId or roleId format");
		}

		const userMaxHierarchy = Math.min(...(req.user?.roles ?? []).map((r: any) => r.hierarchyLevel));
		await service.revokePermissionFromRole(roleId, permissionId, userMaxHierarchy);

		return successResponse(res, 200, null, "Permission revoked from role successfully");
	}
}

