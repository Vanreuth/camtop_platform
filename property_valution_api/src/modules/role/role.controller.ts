import type { Request, Response } from "express";
import type { AuthRequest } from "../../common/types/auth.type";
import { RoleService } from "./role.service";
import { successResponse } from "../../common/utils/responseHelper";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { ForbiddenError } from "../../common/errors/forbidden.error";

const service = new RoleService();

export class RoleController {
  private static buildRoleResponse(role: any) {
    return {
      id: role.id,
      roleName: role.roleName,
      roleCode: role.roleCode,
      hierarchyLevel: role.hierarchyLevel,
      description: role.description,
      isActive: role.isActive,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role.userCount ?? role.users?.length ?? 0,
      permissionCount: role.permissionCount ?? role.permissions?.length ?? 0,
      users:
        role.users?.map((ur: any) => ({
          id: ur.user?.id,
          username: ur.user?.username,
          email: ur.user?.email,
        })) ?? [],
      permissions:
        role.permissions?.map((rp: any) => ({
          id: rp.permission?.id,
          permissionName: rp.permission?.permissionName,
          permissionCode: rp.permission?.permissionCode,
          action: rp.permission?.action,
          resource: rp.permission?.resource,
          description: rp.permission?.description,
          isActive: rp.permission?.isActive,
        })) ?? [],
    };
  }

  static async getAllRoles(req: Request, res: Response) {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    // backward-compatible support for skip/take
    const take = Number(req.query.take);
    const skip = Number(req.query.skip);

    const sortBy = (req.query.sortBy as string) || "hierarchyLevel";
    const sortOrder = (req.query.sortOrder as "asc" | "desc") || "asc";

    const filters = {
      role: req.query.role as string,
      search: req.query.search as string,
      createdAfter: req.query.createdAfter
        ? new Date(req.query.createdAfter as string)
        : undefined,
      createdBefore: req.query.createdBefore
        ? new Date(req.query.createdBefore as string)
        : undefined,
      hierarchyLevel:
        req.query.hierarchyLevel !== undefined
          ? Number(req.query.hierarchyLevel)
          : undefined,
      hasUsers:
        req.query.hasUsers !== undefined
          ? String(req.query.hasUsers) === "true"
          : undefined,
      hasPermissions:
        req.query.hasPermissions !== undefined
          ? String(req.query.hasPermissions) === "true"
          : undefined,
    };

    const result = await service.getAllRoles(
      {
        page: Number.isFinite(page) ? page : 1,
        limit: Number.isFinite(limit) ? limit : 10,
        skip: Number.isFinite(skip) ? skip : undefined,
        take: Number.isFinite(take) ? take : undefined,
        sortBy,
        sortOrder,
      },
      filters
    );

    return successResponse(
      res,
      200,
      { roles: result.roles.map(RoleController.buildRoleResponse) },
      "Get Roles successfully",
      { pagination: result.pagination }
    );
  }

  static async getRoleById(req: Request, res: Response) {
    const roleId = Number(req.params.id);
    if (!roleId || Number.isNaN(roleId)) throw new BadRequestError("Valid role ID is required");
    const role = await service.getRoleById(roleId);

    return successResponse(
      res,
      200,
      { role: RoleController.buildRoleResponse(role) },
      "Role fetched successfully"
    );
  }

  static async create(req: Request, res: Response) {
    const role = await service.createRole(req.body);
    return successResponse(
      res,
      201,
      { role: RoleController.buildRoleResponse(role) },
      "Role created successfully"
    );
  }

  static async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) throw new BadRequestError("Valid role ID is required");
    const role = await service.updateRole(id, req.body);
    return successResponse(
      res,
      200,
      { role: RoleController.buildRoleResponse(role) },
      "Role updated successfully"
    );
  }
  static async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) throw new BadRequestError("Valid role ID is required");
    await service.deleteRole(id);

    return successResponse(res, 200, null, "Role deleted successfully");
  }

  static async assign(req: AuthRequest, res: Response) {
  if (!req.user) throw new ForbiddenError("User not authenticated");

  const { userId, roleIds } = req.body as any;

  await service.assignRolesToUser({
    userId: Number(userId),
    roleIds: Array.isArray(roleIds) ? roleIds.map(Number) : [],
    assignedBy: req.user.id,
  });

  return successResponse(res, 200, null, "Roles assigned to user successfully");
}

  static async revoke(req: AuthRequest, res: Response) {
    if (!req.user) throw new ForbiddenError("User not authenticated");
    const userId = Number(req.params.userId);
    const roleId = Number(req.params.roleId);
    await service.revokeRoleFromUser(userId, roleId);

    return successResponse(res, 200, null, "Role revoked from user successfully");
  }
}
