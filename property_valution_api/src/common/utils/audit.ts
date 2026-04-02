import { prisma } from "../../db/prisma";

export const logAction = async (
  action: string,
  userId?: number,
  entity?: string,
  entityId?: number,
  details?: string,
  ipAddress?: string,
  userAgent?: string
) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId,
        entity,
        entityId,
        details,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to log action:", error);
  }
};
