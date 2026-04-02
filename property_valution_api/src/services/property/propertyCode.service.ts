
import { PrismaClient } from "@prisma/client";

export const createPropertyCodeService = (prisma: PrismaClient) => {
  const generateCode = async (propertyTypeName: string) => {
    const prefix = propertyTypeName
      .substring(0, 4)
      .toUpperCase()
      .replace(/[^A-Z]/g, "");

    const last = await prisma.property.findFirst({
      where: { propertyCode: { startsWith: prefix } },
      orderBy: { propertyCode: "desc" },
      select: { propertyCode: true },
    });

    let nextNumber = 1;
    if (last?.propertyCode) {
      const lastNumber = parseInt(last.propertyCode.slice(prefix.length), 10);
      nextNumber = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
    }

    return `${prefix}${String(nextNumber).padStart(4, "0")}`;
  };

  const buildName = (inputName: string | undefined, typeName: string, code: string) =>
    inputName?.trim() || `${typeName} ${code}`;

  return { generateCode, buildName };
};
