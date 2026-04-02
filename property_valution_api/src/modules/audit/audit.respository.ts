import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";

export class AuditRepository {
  count(where: Prisma.AuditLogWhereInput) {
    return prisma.auditLog.count({ where });
  }

  findMany(params: Prisma.AuditLogFindManyArgs) {
    return prisma.auditLog.findMany(params);
  }

  create(data: Prisma.AuditLogUncheckedCreateInput) {
    return prisma.auditLog.create({ data });
  }

  deleteMany(where: Prisma.AuditLogWhereInput) {
    return prisma.auditLog.deleteMany({ where });
  }

  groupByAction(where: Prisma.AuditLogWhereInput) {
    return prisma.auditLog.groupBy({
      by: ["action"],
      where,
      _count: { action: true },
      orderBy: { _count: { action: "desc" } },
    });
  }

  groupByEntity(where: Prisma.AuditLogWhereInput) {
    return prisma.auditLog.groupBy({
      by: ["entity"],
      where: {
        ...where,
        entity: { not: null },
      },
      _count: { entity: true },
      orderBy: { _count: { entity: "desc" } },
    });
  }

  getRecentActivity(where: Prisma.AuditLogWhereInput, take = 10) {
    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  groupByCreatedAt(where: Prisma.AuditLogWhereInput) {
    return prisma.auditLog.groupBy({
      by: ["createdAt"],
      where,
      _count: { id: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
