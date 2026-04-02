import bcrypt from "bcryptjs";
import { Prisma, AccountStatus } from "@prisma/client";
import { UserRepository } from "./user.respository";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { NotFoundError } from "../../common/errors/notFound.error";
import { ForbiddenError } from "../../common/errors/forbidden.error";
import { FileUploadService } from "../../services/fileUpload.service";
import { AuditService } from "../audit/audit.service";

type PaginationOptions = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

type SearchFilters = {
  status?: AccountStatus;
  role?: string;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
};

export class UserService {
  constructor(
    private userRepository = new UserRepository(),
    private auditService = new AuditService(),
  ) {}

  async create(
    userData: {
      username: string;
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
      bio?: string;
      status?: AccountStatus;
    },
    options: { roleId: number; assignedBy: number },
    file?: Express.Multer.File,
  ) {
    const parsedRoleId = Number(options.roleId);
    if (!parsedRoleId) throw new BadRequestError("roleId is required");
    if (!options.assignedBy)
      throw new BadRequestError("assignedBy (admin id) is required");

    const existingUser = await this.userRepository.findFirst({
      where: {
        OR: [{ email: userData.email }, { username: userData.username }],
      },
    });
    if (existingUser) {
      throw new BadRequestError(
        "User already exists with this email or username",
      );
    }

    const role = await this.userRepository.findRoleById(parsedRoleId);
    if (!role) throw new BadRequestError(`Role ${parsedRoleId} not found`);

    const hashedPassword = await bcrypt.hash(userData.password, 12);

    const newUser = await this.userRepository.create({
      data: {
        ...userData,
        password: hashedPassword,
        roles: {
          create: {
            roleId: parsedRoleId,
            assignedBy: options.assignedBy,
          },
        },
      },
    });

    let createdUser: any;

    if (!file) {
      createdUser = await this.userRepository.findUnique({
        where: { id: newUser.id },
        include: { roles: { include: { role: true } } },
      });
    } else {
      const profilePicture = await FileUploadService.uploadFile(file, "profile");
      createdUser = await this.userRepository.update({
        where: { id: newUser.id },
        data: { profilePicture },
        include: { roles: { include: { role: true } } },
      });
    }

    await this.auditService.logAction(
      "USER_CREATED",
      options.assignedBy,
      "User",
      newUser.id,
      {
        email: newUser.email,
        username: newUser.username,
        assignedRoleId: parsedRoleId,
        hasProfilePicture: Boolean(file),
      },
    );

    return createdUser;
  }

  async getAuditLogs(
    userId: number,
    pagination: { page?: number; limit?: number } = {},
  ) {
    const page = Math.max(1, pagination.page ?? 1);
    const limit = Math.min(Math.max(1, pagination.limit ?? 20), 100);

    return this.auditService.getUserAuditLogs(userId, {
      skip: (page - 1) * limit,
      take: limit,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  }

  async findByEmail(email: string) {
    return this.userRepository.findUnique({ where: { email } });
  }

  async findByUsername(username: string) {
    return this.userRepository.findUnique({ where: { username } });
  }

  async findById(id: number) {
    return this.userRepository.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: {
                      select: {
                        id: true,
                        permissionName: true,
                        permissionCode: true,
                        action: true,
                        resource: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async findAll(
    pagination: PaginationOptions = {},
    filters: SearchFilters = {},
  ) {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = pagination;

    const skip = (page - 1) * limit;
    const { status, role, search, createdAfter, createdBefore } = filters;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) where.status = status;
    if (role) {
      where.roles = {
        some: {
          role: {
            roleCode: role,
          },
        },
      };
    }

    if (createdAfter)
      where.createdAt = { ...(where.createdAt as any), gte: createdAfter };
    if (createdBefore)
      where.createdAt = { ...(where.createdAt as any), lte: createdBefore };

    const [users, total] = await Promise.all([
      this.userRepository.findMany({
        skip,
        take: limit,
        where,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          status: true,
          profilePicture: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  roleName: true,
                },
              },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
      }),
      this.userRepository.count(where),
    ]);

    const formattedUsers = users.map((u: any) => ({
      ...u,
      roleName: u.roles?.[0]?.role?.roleName || "Unknown Role",
    }));

    return {
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    };
  }
  
  async findUserStatistics() {
	return this.userRepository.getUserStatistics();
  }

  async updateUser(
    userIdToUpdate: number,
    authenticatedUser: { id: number; permissions: string[] },
    userData: {
      username?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      bio?: string;
      status?: AccountStatus;
      roleId?: string | number;
    },
    file?: Express.Multer.File,
  ) {
    const canUpdate =
      authenticatedUser.id === userIdToUpdate ||
      authenticatedUser.permissions.includes("user:manage") ||
      authenticatedUser.permissions.includes("user:update");

    if (!canUpdate) {
      throw new ForbiddenError(
        "You do not have permission to update this user",
      );
    }

    const existingUser = await this.userRepository.findUnique({
      where: { id: userIdToUpdate },
      include: { roles: true },
    });
    if (!existingUser) throw new NotFoundError("User not found");
    const existingRoleId = (existingUser as any).roles?.[0]?.roleId;

    const { roleId, ...restOfData } = userData;

    const dataToUpdate: Prisma.UserUpdateInput = {
      username: restOfData.username,
      email: restOfData.email,
      firstName: restOfData.firstName,
      lastName: restOfData.lastName,
      phone: restOfData.phone,
      status: restOfData.status,
      bio: restOfData.bio,
    };
    if (roleId) {
      const parsedRoleId = Number(roleId);
      if (existingRoleId !== parsedRoleId) {
        dataToUpdate.roles = {
          deleteMany: {},
          create: {
            roleId: parsedRoleId,
            assignedBy: authenticatedUser.id,
          },
        };
      }
    }

    if (dataToUpdate.email && dataToUpdate.email !== existingUser.email) {
      const emailExists = await this.findByEmail(dataToUpdate.email as string);
      if (emailExists) throw new BadRequestError("Email already exists");
    }

    if (
      dataToUpdate.username &&
      dataToUpdate.username !== existingUser.username
    ) {
      const usernameExists = await this.findByUsername(
        dataToUpdate.username as string,
      );
      if (usernameExists) throw new BadRequestError("Username already exists");
    }

    if (file) {
      const newProfilePictureUrl = await FileUploadService.uploadFile(
        file,
        `profile/${userIdToUpdate}`,
      );
      dataToUpdate.profilePicture = newProfilePictureUrl;

      if (existingUser.profilePicture) {
        await FileUploadService.deleteFile(existingUser.profilePicture);
      }
    }

    const updatedUser = await this.userRepository.update({
      where: { id: userIdToUpdate },
      data: dataToUpdate,
      include: { roles: { include: { role: true } } },
    });

    const changedFields = Object.keys(restOfData).filter(
      (key) => (restOfData as Record<string, unknown>)[key] !== undefined,
    );

    const roleIdChanged =
      roleId !== undefined && Number(roleId) !== Number(existingRoleId);
    if (roleIdChanged) {
      changedFields.push("roleId");
    }
    if (file) {
      changedFields.push("profilePicture");
    }

    await this.auditService.logAction(
      "USER_UPDATED",
      authenticatedUser.id,
      "User",
      userIdToUpdate,
      {
        updatedBy: authenticatedUser.id,
        changedFields: [...new Set(changedFields)],
        previousRoleId: existingRoleId ?? null,
        currentRoleId: (updatedUser as any).roles?.[0]?.roleId ?? null,
      },
    );

    return updatedUser;
  }

  async updateUserRole(
    userIdToUpdate: number,
    authenticatedUser: { id: number; permissions: string[] },
    roleId: number,
  ) {
    const canManage =
      authenticatedUser.permissions.includes("user:manage") ||
      authenticatedUser.permissions.includes("user:update");

    // Role changes should be admin-only (no self role change)
    if (!canManage || authenticatedUser.id === userIdToUpdate) {
      throw new ForbiddenError(
        "You do not have permission to change this user's role",
      );
    }

    const existingUser = await this.userRepository.findUnique({
      where: { id: userIdToUpdate },
      include: { roles: true },
    });
    if (!existingUser) throw new NotFoundError("User not found");

    const parsedRoleId = Number(roleId);
    if (!parsedRoleId) throw new BadRequestError("roleId is required");

    const role = await this.userRepository.findRoleById(parsedRoleId);
    if (!role) throw new BadRequestError(`Role ${parsedRoleId} not found`);

    const currentRoleId = (existingUser as any).roles?.[0]?.roleId;
    if (currentRoleId === parsedRoleId) {
      return this.findById(userIdToUpdate);
    }

    await this.userRepository.update({
      where: { id: userIdToUpdate },
      data: {
        roles: {
          deleteMany: {},
          create: {
            roleId: parsedRoleId,
            assignedBy: authenticatedUser.id,
          },
        },
      },
    });

    await this.auditService.logAction(
      "USER_ROLE_UPDATED",
      authenticatedUser.id,
      "User",
      userIdToUpdate,
      {
        previousRoleId: currentRoleId ?? null,
        newRoleId: parsedRoleId,
      },
    );

    return this.findById(userIdToUpdate);
  }

  async deleteById(id: number, performedBy?: number) {
    const user = await this.userRepository.findUnique({ where: { id } });
    if (!user) throw new NotFoundError("User not found");
    if (user.status === "DISABLED")
      throw new BadRequestError("User is already inactive");

    const result = await this.userRepository.update({
      where: { id },
      data: { status: "DISABLED" },
    });

    await this.auditService.logAction(
      "USER_DISABLED",
      performedBy,
      "User",
      id,
      {
        previousStatus: user.status,
        currentStatus: "DISABLED",
      },
    );

    return result;
  }

  async reactivateUser(id: number, performedBy?: number) {
    const existingUser = await this.userRepository.findUnique({
      where: { id },
    });
    if (!existingUser) throw new NotFoundError("User not found");

    await this.userRepository.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    await this.auditService.logAction(
      "USER_REACTIVATED",
      performedBy,
      "User",
      id,
      {
        previousStatus: existingUser.status,
        currentStatus: "ACTIVE",
      },
    );
  }

  async comparePassword(plainPassword: string, hashedPassword: string) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async updatePassword(id: number, newPassword: string) {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    return this.userRepository.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  async getUserStatistics(filters?: {
    startDate?: string;
    endDate?: string;
    roleId?: number;
  }) {
    const parsedFilters = {
      startDate: filters?.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters?.endDate ? new Date(filters.endDate) : undefined,
      roleId: filters?.roleId ? Number(filters.roleId) : undefined,
    };

    return this.userRepository.getUserStatistics(parsedFilters);
  }
}
