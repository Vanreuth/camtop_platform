import { prisma } from "../../db/prisma";

export class RoleRepository {
  findMany(params: any) {
    return prisma.role.findMany(params);
  }

  count(where: any) {
    return prisma.role.count({ where });
  }

  findById(id: number) {
    return prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        users: {
          include: {
            user: { select: { id: true, username: true, email: true } },
          },
        },
      },
    });
  }

  findRolesByIds(roleIds: number[]) {
  return prisma.role.findMany({
    where: { id: { in: roleIds } },
    select: { id: true },
  });
}

  findFirst(where: any) {
    return prisma.role.findFirst({ where });
  }

  create(data: any) {
    return prisma.role.create({ data });
  }

  update(id: number, data: any) {
    return prisma.role.update({
      where: { id },
      data,
      include: {
        permissions: { include: { permission: true } },
        users: {
          include: {
            user: {
              select: { id: true, username: true, email: true, bio: true },
            },
          },
        },
      },
    });
  }
   
  async  deleteRole(id: number) {
    await prisma.$transaction([
        prisma.rolePermission.deleteMany({
            where: { roleId: id },
        }),
        prisma.role.delete({
            where: { id },
        }),
    ]);
  }

  findUserById(userId: number) {
    return prisma.user.findUnique({ where: { id: userId } });
  }

  findRoleById(roleId: number) {
    return prisma.role.findUnique({ where: { id: roleId } });
  }

  findUserRole(userId: number, roleId: number) {
    return prisma.userRole.findFirst({
      where: { userId, roleId },
    });
  }

  async assignUserRoles(data: { userId: number; roleIds: number[]; assignedBy: number }) {
  return prisma.userRole.createMany({
    data: data.roleIds.map((roleId) => ({
      userId: data.userId,
      roleId,
      assignedBy: data.assignedBy,
    })),
    skipDuplicates: true,
  });
}

   revokeUserRole(userId: number, roleId: number) {
    return prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });
  }

  getRoleWithRelations(id: number) {
    return prisma.role.findUnique({
      where: { id },
      include: { users: true, permissions: true },
    });
  }


}