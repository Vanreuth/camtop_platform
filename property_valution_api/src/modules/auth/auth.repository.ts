
import { permission } from "process";
import { prisma} from "../../db/prisma";
import { AccountStatus, Prisma} from "@prisma/client";
export class AuthRepository {
  
   // -------------------------
  // User queries
  // -------------------------
  async findById(id: number) {
    return prisma.user.findUnique({ 
      where: { id },
      include: this.userInclude()
    });
  }
  
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
       where: { email },
       include: this.userInclude()
       });
  }

  async findUserByUsername(username: string) {
    return prisma.user.findUnique({
      where: { username },
      include: this.userInclude()
    });
  }

  async createUser(data: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    phone?: string;
    password: string | null;
    profilePicture: string | null;
    status: AccountStatus;
    emailVerified?: Date;

    roleId?: number;
    assignedBy?: number;
  }) {
    const { roleId, assignedBy, ...userData } = data;

    if (!roleId) {
      return prisma.user.create(
        { data: userData, 
        include: this.userInclude(),
       });
    }

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: userData });
      const assignedByUserId = assignedBy ?? user.id;

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId,
          assignedBy: assignedByUserId,
        },
      });

      return tx.user.findUnique({
        where: { id: user.id },
        include: this.userInclude(),
      });
    });
  }

  // -------------------------
  // Preferences
  // -------------------------
  async ensureUserPreferences(userId: number) {
    return prisma.userPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},  
    });
  }

  async findUserPreferences(userId: number) {
    return prisma.userPreference.findUnique({
       where: { userId }
     });
  }

  async getUserProfile(userId: number) {

     await this.ensureUserPreferences(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude(),
    });
    const preferences = await prisma.userPreference.findUnique({
      where: { userId },
    });

    return { user, preferences };
  }

  // Update profile only
  async updateProfile(userId: number, profileData: Prisma.UserUpdateInput) {
    return prisma.user.update({
      where: { id: userId },
      data: profileData,
      include: this.userInclude(),
    });
  }

  // Update preferences only
  async updatePreferences(
    userId: number, 
    preferencesData: Prisma.UserPreferenceUpdateInput
  ) {
    await this.ensureUserPreferences(userId);
    return prisma.userPreference.update({
      where: { userId },
      data: preferencesData,
    });
  }

  // -------------------------
  // Login security helpers
  // -------------------------

  async incrementFailedLogin(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });
  }

  async resetLoginFailures(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, accountLockedUntil: null },
    });
  }

  async lockAccount(userId: number, until: Date) {
    return prisma.user.update({
      where: { id: userId },
      data: { accountLockedUntil: until },
    });
  }
  // -------------------------
  // Accounts (OAuth links)
  // -------------------------
  async findAccount(provider: string, providerAccountId: string) {
    return prisma.account.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: {include: this.userInclude()} },
    });
  }

  async createAccount(data: {
    userId: number;
    provider: string;
    providerAccountId: string;
    refreshToken?: string | null;
    accessToken?: string | null;
    expiresAt?: number | null;
    idToken?: string | null;
    scope?: string | null;
    tokenType?: string | null;
    sessionState?: string | null;
    type?: string | null;
  }) {
    return prisma.account.create({ 
      data:{
        userId: data.userId,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        refresh_token: data.refreshToken ?? null,
        access_token: data.accessToken ?? null,
        expires_at: data.expiresAt ?? null,
        id_token: data.idToken ?? null,
        scope: data.scope ?? null,
        token_type: data.tokenType ?? null,
        session_state: data.sessionState ?? null,
        type: data.type ?? "oauth",
      }
    
    });
  }
  
  // -------------------------
  // Refresh Tokens (improved)
  // -------------------------
  async createRefreshToken(data: {
    token: string;
    userId: number;
    expiresAt: Date 
    }) {
    return prisma.refreshToken.create({
        data:{
        token: data.token,
        userId: data.userId,
        expiresAt: data.expiresAt
       }
    });
  }



  async findRefreshToken(token: string) {
  if (!token) return null;
  return prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });
}

  async revokeRefreshToken(token: string, userId: number) {
    return prisma.refreshToken.updateMany({
      where: { token, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllRefreshTokensForUser(userId: number) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async findReplacementRefreshToken(userId: number, revokedAt: Date) {
    return prisma.refreshToken.findFirst({
      where: {
        userId,
        revokedAt: null,
        createdAt: { gt: revokedAt },
      },
      orderBy: { createdAt: "desc" },
      include: { user: true },
    });
  }

  // -------------------------
  // Email verification (Option A)
  // -------------------------
  async setEmailVerification(userId: number, data: { tokenHash: string; expiresAt: Date }) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifyTokenHash: data.tokenHash,
        emailVerifyExpiresAt: data.expiresAt,
      },
    });
  }

  async findByVerificationToken(tokenHash: string) {
    return prisma.user.findFirst({
      where: { 
        emailVerifyTokenHash: tokenHash,
        emailVerifyExpiresAt: { gt: new Date() }, 
      },
      include: this.userInclude(),
    });
  }

  async findByVerificationTokenHash(tokenHash: string) {
    return prisma.user.findFirst({
      where: {
        emailVerifyTokenHash: tokenHash,
      },
      include: this.userInclude(),
    });
  }

  async clearEmailVerification(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifyTokenHash: null,
        emailVerifyExpiresAt: null,
      },
    });
  }

  async verifyUserEmail(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: new Date(),
        status: "ACTIVE",
        emailVerifyTokenHash: null,
        emailVerifyExpiresAt: null,
      },
      include: this.userInclude(),
    });
  }

  // -------------------------
  // Roles
  // -------------------------

  findRoleByCode(roleCode: string) {
    return prisma.role.findUnique({
      where: { roleCode },
    });
  }

  async assignDefaultRoleToUser(userId: number, assignedBy: number) {
    const defaultRole = await this.findRoleByCode("VIEWER");
    if (!defaultRole) return;
    const existingRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId: defaultRole.id,
        },
      },
    });

    if (!existingRole) {
      await prisma.userRole.create({
        data: {
          userId,
          roleId: defaultRole.id,
          assignedBy,
        },
      });
    }
  }

  // -------------------------
  // Includes (consistent shape)
  // -------------------------
  private userInclude() {
  return {
    roles: {
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    },
  };
}
}


