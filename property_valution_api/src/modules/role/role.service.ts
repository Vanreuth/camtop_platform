import { RoleRepository } from "./role.repository";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { NotFoundError } from "../../common/errors/notFound.error";
import { AppError } from "../../common/errors/app.error";

export class RoleService {
  constructor(private roleRepository = new RoleRepository()) {}

  async getAllRoles(options: any = {}, filters: any = {}) {
    const {
      page,
      limit,
      skip,
      take,
      sortBy = "hierarchyLevel",
      sortOrder = "asc",
    } = options;

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

    const {
      role,
      search,
      createdAfter,
      createdBefore,
      hierarchyLevel,
      hasUsers,
      hasPermissions,
    } = filters;

    const where: any = {};

    // Apply filters

    if (role) where.roleCode = role;

    if (hierarchyLevel !== undefined) {
      where.hierarchyLevel = hierarchyLevel;
    }

    if (search) {
      where.OR = [
        { roleName: { contains: search, mode: "insensitive" } },
        { roleCode: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (createdAfter || createdBefore) {
      where.createdAt = {};
      if (createdAfter) where.createdAt.gte = createdAfter;
      if (createdBefore) where.createdAt.lte = createdBefore;
    }

    if (hasUsers !== undefined) {
      where.users = hasUsers ? { some: {} } : { none: {} };
    }

    if (hasPermissions !== undefined) {
      where.permissions = hasPermissions ? { some: {} } : { none: {} };
    }

    const [roles, total] = await Promise.all([
      this.roleRepository.findMany({
        skip: resolvedSkip,
        take: resolvedLimit,
        where,
        orderBy: { [sortBy]: sortOrder },
        include: {
          permissions: { include: { permission: true } },
          users: {
            include: {
              user: { select: { id: true, username: true, email: true } },
            },
          },
        },
      }),
      this.roleRepository.count(where),
    ]);

    const roleWithCounts = roles.map((role: any) => ({
      ...role,
      userCount: role.users.length,
      permissionCount: role.permissions.length,
    }));

    return {
      roles: roleWithCounts,
      pagination: {
        page: resolvedPage,
        limit: resolvedLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / resolvedLimit)),
        hasNextPage: resolvedSkip + resolvedLimit < total,
        hasPreviousPage: resolvedPage > 1,
      },
    };
  }

  async getRoleById(id: number) {
    const role = await this.roleRepository.findById(id);

    if (!role) throw new NotFoundError("Role not found");

    return {
      ...role,
      userCount: role.users.length,
      permissionCount: role.permissions.length,
    };
  }

  async createRole(data:any){
    const existingRole = await this.roleRepository.findFirst({
        OR:[{roleName:data.roleName}, {roleCode: data.roleCode}]
     });

    if (existingRole) {
      const conflictField = existingRole.roleName === data.roleName ? "name" : "code";
      throw new AppError(`Role with this ${conflictField} already exists`, 409, "CONFLICT");
    }

    return this.roleRepository.create({
        roleName: data.roleName,
        roleCode: data.roleCode,
        hierarchyLevel: data.hierarchyLevel,
        description: data.description,
    });
  }

     async updateRole(id: number, data: any) {
    const existing = await this.roleRepository.findById(id);
    if (!existing) throw new NotFoundError("Role not found");

    if (data.roleName || data.roleCode) {
      const conflictWhere: any = {
        AND: [{ id: { not: id } }, { OR: [] }],
      };

      if (data.roleName) conflictWhere.AND[1].OR.push({ roleName: data.roleName });
      if (data.roleCode) conflictWhere.AND[1].OR.push({ roleCode: data.roleCode });

      const conflict = await this.roleRepository.findFirst(conflictWhere);
      if (conflict) {
        const conflictField = conflict.roleName === data.roleName ? "name" : "code";
        throw new AppError(`Role with this ${conflictField} already exists`, 409, "CONFLICT");
      }
    }

    const updated = await this.roleRepository.update(id, data);
    return {
      ...updated,
      userCount: updated.users.length,
      permissionCount: updated.permissions.length,
    };
  }

  async deleteRole(id: number) {
    const existing = await this.roleRepository.getRoleWithRelations(id);
    if (!existing) throw new NotFoundError("Role not found");
    if (existing.users.length > 0) {
      throw new BadRequestError("Cannot delete role that has users assigned");
    }

    await this.roleRepository.deleteRole(id);
  }

 // role.service.ts
async assignRolesToUser(data: { userId: number; roleIds: number[]; assignedBy: number }) {
  if (!data.assignedBy) throw new BadRequestError("assignedBy is required");

  const userId = Number(data.userId);
  const roleIds = (data.roleIds ?? []).map(Number).filter(Number.isFinite);

  if (!Number.isFinite(userId)) throw new BadRequestError("userId is invalid");
  if (roleIds.length === 0) throw new BadRequestError("roleIds is required");

  const user = await this.roleRepository.findUserById(userId);
  if (!user) throw new NotFoundError("User not found");

  // 1) Validate roles exist
  const roles = await this.roleRepository.findRolesByIds(roleIds);
  const foundIds = new Set(roles.map((r) => r.id));
  const missing = roleIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new NotFoundError(`Role(s) not found: ${missing.join(", ")}`);
  }

  // 2) Assign, skipping duplicates
  await this.roleRepository.assignUserRoles({
    userId,
    roleIds,
    assignedBy: data.assignedBy,
  });

  return { message: "Roles assigned successfully" };
}


  async revokeRoleFromUser(userId: number, roleId: number) {
    const existing = await this.roleRepository.findUserRole(userId, roleId);
    if (!existing) throw new NotFoundError("Role assignment not found");

    await this.roleRepository.revokeUserRole(userId, roleId);
  }
}
