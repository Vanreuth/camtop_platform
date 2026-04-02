import { prisma } from "../../db/prisma";

export class PermissionRepository {
	findMany(params: any) {
		return prisma.permission.findMany(params);
	}

	count(where: any) {
		return prisma.permission.count({ where });
	}

	findById(id: number) {
		return prisma.permission.findUnique({
			where: { id },
			include: {
				roles: {
					include: {
						role: {
							select: { id: true, roleName: true, roleCode: true, hierarchyLevel: true, isActive: true },
						},
					},
				},
			},
		});
	}

	findFirst(where: any) {
		return prisma.permission.findFirst({ where });
	}

	create(data: any) {
		return prisma.permission.create({ data });
	}

	update(id: number, data: any) {
		return prisma.permission.update({
			where: { id },
			data,
		});
	}

	findRoleById(roleId: number) {
		return prisma.role.findUnique({ where: { id: roleId } });
	}

	findActiveRoleById(roleId: number) {
		return prisma.role.findFirst({ where: { id: roleId, isActive: true } });
	}

	findActivePermissionById(permissionId: number) {
		return prisma.permission.findFirst({ where: { id: permissionId, isActive: true } });
	}

	findRolePermission(roleId: number, permissionId: number) {
		return prisma.rolePermission.findFirst({ where: { roleId, permissionId } });
	}

	upsertRolePermission(data: { roleId: number; permissionId: number; assignedBy: number }) {
		return prisma.rolePermission.upsert({
			where: {
				roleId_permissionId: { roleId: data.roleId, permissionId: data.permissionId },
			},
			create: {
				roleId: data.roleId,
				permissionId: data.permissionId,
				assignedBy: data.assignedBy,
			},
			update: {
				assignedBy: data.assignedBy,
				assignedAt: new Date(),
			},
		});
	}

	deleteRolePermission(roleId: number, permissionId: number) {
		return prisma.rolePermission.delete({
			where: {
				roleId_permissionId: { roleId, permissionId },
			},
		});
	}
}

