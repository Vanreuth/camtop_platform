import ExcelJS from "exceljs";
import { AccountStatus, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";

export type UserReportExportFilters = {
  status?: AccountStatus;
  role?: string;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
};

const buildUserWhere = (
  filters: UserReportExportFilters = {},
): Prisma.UserWhereInput => {
  const where: Prisma.UserWhereInput = {};

  if (filters.search?.trim()) {
    where.OR = [
      { email: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
      { username: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
      { firstName: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
      { lastName: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.role?.trim()) {
    where.roles = {
      some: {
        role: {
          roleCode: filters.role.trim(),
        },
      },
    };
  }

  if (filters.createdAfter) {
    where.createdAt = {
      ...(where.createdAt as Prisma.DateTimeFilter | undefined),
      gte: filters.createdAfter,
    };
  }

  if (filters.createdBefore) {
    where.createdAt = {
      ...(where.createdAt as Prisma.DateTimeFilter | undefined),
      lte: filters.createdBefore,
    };
  }

  return where;
};

export const getUsersForExport = async (
  filters: UserReportExportFilters = {},
) => {
  const users = await prisma.user.findMany({
    where: buildUserWhere(filters),
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      createdAt: true,
      roles: {
        include: {
          role: {
            select: {
              roleName: true,
              roleCode: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map((user) => ({
    ...user,
    roleName:
      user.roles
        .map((role) => role.role?.roleName)
        .filter(Boolean)
        .join(", ") || "Unknown Role",
    roleCode:
      user.roles
        .map((role) => role.role?.roleCode)
        .filter(Boolean)
        .join(", ") || "-",
  }));
};

export const exportUsersToExcel = async (
  filters: UserReportExportFilters = {},
): Promise<Uint8Array> => {
  const users = await getUsersForExport(filters);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CAMTOP Property Group";
  workbook.company = "CAMTOP Property Group";
  workbook.subject = "Users Export";
  workbook.title = "Users Export";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("users");
  worksheet.columns = [
    { header: "User ID", key: "id", width: 12 },
    { header: "Username", key: "username", width: 24 },
    { header: "Full Name", key: "fullName", width: 28 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Status", key: "status", width: 16 },
    { header: "Role Name", key: "roleName", width: 26 },
    { header: "Role Code", key: "roleCode", width: 22 },
    { header: "Created At", key: "createdAt", width: 22 },
  ];

  users.forEach((user) => {
    worksheet.addRow({
      id: user.id,
      username: user.username,
      fullName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
      email: user.email,
      phone: user.phone ?? "-",
      status: user.status,
      roleName: user.roleName,
      roleCode: user.roleCode,
      createdAt: user.createdAt,
    });
  });

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" },
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  worksheet.getColumn("createdAt").numFmt = "yyyy-mm-dd hh:mm";

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
};
