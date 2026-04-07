import bcrypt from "bcryptjs";
import { AuthRepository } from "./auth.repository";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { ForbiddenError } from "../../common/errors/forbidden.error";
import { UnauthorizedError } from "../../common/errors/unauthorzed.error";
import { NotFoundError } from "../../common/errors/notFound.error";
import { FileUploadService } from "../../services/fileUpload.service";
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
} from "../../common/utils/jwt";
import { verifyGoogleIdToken } from "../../common/utils/googleOAuth";
import { logger } from "../../config/logger";
import type { RegisterDto, LoginDto, ChangePasswordDto, UpdatePreferencesDto } from "./auth.dto";
import type { UpdateMeDto } from "../../common/types/user.type";
import {
  generateEmailVerifyToken,
  hashEmailVerifyToken,
  isWellFormedEmailVerifyToken,
  normalizeEmailVerifyToken,
} from "../../common/utils/emailVerifyToken";
import EmailService from "../../services/email.service";
import type { Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";

type TokenUser = { id: number; email: string; username: string };
type AuditContext = { ipAddress?: string; userAgent?: string };

export class AuthService {
  constructor(
    private repo = new AuthRepository(),
    private auditService = new AuditService(),
  ) {}

   // -------------------------
  // Helpers
  // -------------------------
  private comparePassword(plain: string, hashed: string) {
    return bcrypt.compare(plain, hashed);
  }

  private buildUserResponse(user: any) {
    return {
      id: user.id,
      email: user.email,
      lastName: user.lastName,
      firstName: user.firstName,
      username: user.username,
      phone: user.phone,
      role: user.roles?.[0]?.role?.roleName || "USER",
      profilePicture: user.profilePicture,
      status: user.status,
      bio: user.bio,
    };
  }

  private ensureActive(user: any) {
    if (user.status !== "ACTIVE") {
      throw new UnauthorizedError("User account is not active");
    }
  }

   private ensureNotLocked(user: any) {
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      throw new UnauthorizedError("Account is locked. Try again later.");
    }
  }

  private async getUserByIdentifier(identifier: string) {
    const value = identifier.trim();
    if (!value) throw new BadRequestError("username/email is required");

    return value.includes("@")
      ? this.repo.findUserByEmail(value)
      : this.repo.findUserByUsername(value);
  }

   private extractRolesAndPermissions(user: any) {
  const rolesArr = (user.roles ?? []) as any[];

  const permissionSet = new Set<string>();

  for (const r of rolesArr) {
    const role = r?.role;
    const rp = role?.permissions ?? [];

    for (const item of rp) {
      const code = item?.permission?.permissionCode;
      if (code) permissionSet.add(String(code));
    }
  }

  const roles = rolesArr.map((r) => ({
    roleId: r?.role?.id,
    roleCode: r?.role?.roleCode,
    roleName: r?.role?.roleName,
    hierarchyLevel: r?.role?.hierarchyLevel,
    isActive: r?.role?.isActive ?? true,
  }));

  return { roles, permissions: Array.from(permissionSet) };
}
  
  /**
   * Issue access + refresh tokens and store refresh token in DB.
   * If your repo supports linking replacements, you can pass replacedToken to track rotation.
   */
  private async issueTokens(user: TokenUser) {
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    const refreshToken = generateRefreshToken({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    await this.repo.createRefreshToken({
      token: refreshToken,
      userId: user.id,
      expiresAt: getRefreshTokenExpiry(),
    });

    return { accessToken, refreshToken };
  }

  private async generateUniqueUsername(base: string) {
    const clean = base.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30) || "user";
    let candidate = clean;

    const exists1 = await this.repo.findUserByUsername(candidate);
    if (!exists1) return candidate;

    for (let i = 0; i < 10; i++) {
      const suffix = Math.floor(1000 + Math.random() * 9000); // 4 digits
      candidate = `${clean}_${suffix}`;
      const exists = await this.repo.findUserByUsername(candidate);
      if (!exists) return candidate;
    }
    return `${clean}_${Date.now().toString().slice(-6)}`;
  }

  private buildVerifyEmailUrl(token: string) {
    const encodedToken = encodeURIComponent(token);
    const verifyLinkTarget = (process.env.EMAIL_VERIFY_LINK_TARGET ?? "backend")
      .trim()
      .toLowerCase();
    const frontendBaseUrl = process.env.FRONTEND_URL?.trim().replace(/\/+$/, "");

    if (verifyLinkTarget === "frontend" && frontendBaseUrl) {
      return `${frontendBaseUrl}/en/verify-email?token=${encodedToken}`;
    }

    const appBaseUrl = (process.env.APP_URL || "http://localhost:4000").trim().replace(/\/+$/, "");
    return `${appBaseUrl}/api/auth/verify-email?token=${encodedToken}`;
  }

  private async issueVerificationTokenAndSendEmail(user: {
    id: number;
    email: string;
    firstName?: string | null;
  }) {
    const { token, tokenHash, expiresAt } = generateEmailVerifyToken();

    await this.repo.setEmailVerification(user.id, { tokenHash, expiresAt });

    const verifyUrl = this.buildVerifyEmailUrl(token);
    await EmailService.sendVerificationEmail(
      user.email,
      user.firstName ?? "there",
      verifyUrl
    );

    return { expiresAt };
  }

  private async logAuthAction(
    action: string,
    userId?: number,
    details?: Prisma.InputJsonValue,
    auditContext?: AuditContext,
    entityId?: number
  ) {
    await this.auditService.logAction(
      action,
      userId,
      "Auth",
      entityId ?? userId,
      details,
      auditContext?.ipAddress,
      auditContext?.userAgent
    );
  }

  // -------------------------
  // Register
  // -------------------------

  async register(
    userData: RegisterDto,
    file?: Express.Multer.File,
    auditContext?: AuditContext
  ) {
    // Check if user exists
    const existingUser = await this.repo.findUserByEmail(userData.email);

    if (existingUser && existingUser.password) {
      throw new BadRequestError("User already exists with this email");
    }
    
    // Check username uniqueness
    if (!existingUser) {
      const usernameOwner = await this.repo.findUserByUsername(userData.username);
      if (usernameOwner) {
        throw new BadRequestError("Username already taken");
      }
    }
    
    if (existingUser && userData.username !== existingUser.username) {
      const usernameOwner = await this.repo.findUserByUsername(userData.username);
      if (usernameOwner && usernameOwner.id !== existingUser.id) {
        throw new BadRequestError("Username already taken");
      }
    }

    const hashedPassword = await bcrypt.hash(userData.password, 12);

    let profilePictureUrl: string | undefined;
    if (file) {
      profilePictureUrl = await FileUploadService.uploadFile(file, "profile");
    }

    // Create or update user
    let user: any;
    if (existingUser && !existingUser.password) {
      user = await this.repo.updateProfile(
        existingUser.id,
        {
          username: userData.username,
          firstName: userData.firstName,
          lastName: userData.lastName,
          password: hashedPassword,
          profilePicture: profilePictureUrl ?? existingUser.profilePicture,
          status: "PENDING",
          emailVerified: null,
        },
      );
    } else {
      user = await this.repo.createUser({
        email: userData.email,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: hashedPassword,
        profilePicture: profilePictureUrl ?? null,
        status: "PENDING",
        emailVerified: null,
      } as any);
    }

    const preferences = await this.repo.ensureUserPreferences(user.id);

    // Ensure the user has at least the default role (required by auth middleware)
    if (!user.roles || user.roles.length === 0) {
      await this.repo.assignDefaultRoleToUser(user.id, user.id);
      user = await this.repo.findById(user.id);
    }

    let verificationEmailSent = true;
    try {
      await this.issueVerificationTokenAndSendEmail(user);
    } catch (e) {
      logger.error({ err: e, userId: user.id }, "Failed to send verify email");
      verificationEmailSent = false;
    }

    const { roles, permissions } = this.extractRolesAndPermissions(user);

    await this.logAuthAction(
      "AUTH_REGISTERED",
      user.id,
      {
        email: user.email,
        username: user.username,
        status: user.status,
        hasProfilePicture: Boolean(profilePictureUrl ?? user.profilePicture),
        verificationEmailSent,
      },
      auditContext,
      user.id
    );

    return {
      user: this.buildUserResponse(user),
      preferences,
      roles,
      permissions,
      verificationEmailSent,
    };
  }

  // Verify email with token
  async verifyEmail(rawToken: string, auditContext?: AuditContext) {
    const token = normalizeEmailVerifyToken(rawToken);

    if (!token || !isWellFormedEmailVerifyToken(token)) {
      throw new BadRequestError("Invalid verification token");
    }

    const tokenHash = hashEmailVerifyToken(token);
    const user = await this.repo.findByVerificationTokenHash(tokenHash);

    if (!user) {
      await this.logAuthAction(
        "AUTH_EMAIL_VERIFICATION_FAILED",
        undefined,
        {
          reason: "TOKEN_NOT_FOUND",
          tokenPrefix: token.slice(0, 8),
        },
        auditContext
      );
      throw new BadRequestError("Invalid or already used verification token");
    }

    if (user.emailVerified) {
      await this.repo.clearEmailVerification(user.id);
      return {
        message: "Email already verified. You can log in now.",
        user: this.buildUserResponse(user),
        alreadyVerified: true,
      };
    }

    if (!user.emailVerifyExpiresAt || user.emailVerifyExpiresAt <= new Date()) {
      await this.repo.clearEmailVerification(user.id);
      await this.logAuthAction(
        "AUTH_EMAIL_VERIFICATION_FAILED",
        user.id,
        { reason: "TOKEN_EXPIRED", email: user.email },
        auditContext,
        user.id
      );
      throw new BadRequestError("Verification link expired. Please request a new link.");
    }

    // Mark email as verified and activate account
    const verifiedUser = await this.repo.verifyUserEmail(user.id);

    await this.logAuthAction(
      "AUTH_EMAIL_VERIFIED",
      verifiedUser.id,
      { email: verifiedUser.email },
      auditContext,
      verifiedUser.id
    );

    return {
      message: 'Email verified successfully! Your account is now active.',
      user: this.buildUserResponse(verifiedUser),
      alreadyVerified: false,
    };
  }
  

  // Resend verification email
  async resendVerificationEmail(email: string, auditContext?: AuditContext) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestError("Email is required");
    }

    const genericMessage = "If the account exists and is not verified, a verification email has been sent.";
    const user = await this.repo.findUserByEmail(normalizedEmail);
    
    if (!user) {
      await this.logAuthAction(
        "AUTH_VERIFICATION_EMAIL_RESENT",
        undefined,
        { email: normalizedEmail, exists: false },
        auditContext
      );
      return { message: genericMessage };
    }

    if (user.emailVerified) {
      await this.logAuthAction(
        "AUTH_VERIFICATION_EMAIL_RESENT",
        user.id,
        { email: user.email, skipped: "ALREADY_VERIFIED" },
        auditContext,
        user.id
      );
      return { message: genericMessage };
    }

    await this.issueVerificationTokenAndSendEmail(user);

    await this.logAuthAction(
      "AUTH_VERIFICATION_EMAIL_RESENT",
      user.id,
      { email: user.email },
      auditContext,
      user.id
    );

    return {
      message: genericMessage,
    };
  }

  // -------------------------
  // Login (improved)
  // -------------------------
  async login(loginData: LoginDto, auditContext?: AuditContext) {

    const user = await this.getUserByIdentifier(loginData.username);

     // Always generic error to avoid enumeration
    if (!user) {
      await this.logAuthAction(
        "AUTH_LOGIN_FAILED",
        undefined,
        {
          identifier: loginData.username,
          reason: "USER_NOT_FOUND",
        },
        auditContext
      );
      throw new UnauthorizedError("Invalid credentials");
    }

    this.ensureNotLocked(user);

    // If user is pending (email not verified), block early with clear message
    if (user.status !== "ACTIVE") {
      if (!user.emailVerified) {
        await this.logAuthAction(
          "AUTH_LOGIN_FAILED",
          user.id,
          { reason: "EMAIL_NOT_VERIFIED" },
          auditContext,
          user.id
        );
        throw new UnauthorizedError("Email not verified. Please check your inbox.");
      }
      await this.logAuthAction(
        "AUTH_LOGIN_FAILED",
        user.id,
        {
          reason: "ACCOUNT_NOT_ACTIVE",
          status: user.status,
        },
        auditContext,
        user.id
      );
      throw new UnauthorizedError("User account is not active");
    }

    // OAuth-only user (no local password)
    if (!user.password) {
      await this.logAuthAction(
        "AUTH_LOGIN_FAILED",
        user.id,
        { reason: "GOOGLE_ONLY_ACCOUNT" },
        auditContext,
        user.id
      );
      throw new UnauthorizedError("This account uses Google sign-in. Please login with Google.");
    }

    const ok = await this.comparePassword(loginData.password, user.password);

    // Optional security hardening: failed attempts + lock
    if (!ok) {
      // Track failed attempts + lock rule (example)
      await this.repo.incrementFailedLogin(user.id);

      const fresh = await this.repo.findById(user.id);
      const attempts = fresh?.failedLoginAttempts ?? 0;

      if (attempts >= 5) {
        // lock 10 minutes
        await this.repo.lockAccount(user.id, new Date(Date.now() + 10 * 60 * 1000));
      }

      await this.logAuthAction(
        "AUTH_LOGIN_FAILED",
        user.id,
        {
          reason: "INVALID_PASSWORD",
          failedAttempts: attempts,
        },
        auditContext,
        user.id
      );

      throw new UnauthorizedError("Invalid credentials");
    }


    // reset on success
    await this.repo.resetLoginFailures(user.id);

    await this.repo.updateProfile(user.id, { lastLogin: new Date() });

    const { accessToken, refreshToken } = await this.issueTokens(user as TokenUser);
    const preferences = await this.repo.ensureUserPreferences(user.id);
    const { roles, permissions } = this.extractRolesAndPermissions(user);

    await this.logAuthAction(
      "AUTH_LOGIN_SUCCESS",
      user.id,
      { identifier: loginData.username },
      auditContext,
      user.id
    );

    return {
      accessToken,
      refreshToken,
      user: this.buildUserResponse(user),
      preferences,
      roles,
      permissions,
    };
  }

   // -------------------------
  // Refresh (improved logic)
  // -------------------------
   async refreshAccessToken(oldRefreshToken: string, auditContext?: AuditContext) {
    if (!oldRefreshToken) {
      await this.logAuthAction(
        "AUTH_TOKEN_REFRESH_FAILED",
        undefined,
        { reason: "MISSING_REFRESH_TOKEN" },
        auditContext
      );
      throw new BadRequestError("Invalid refresh token");
    }

    // 1) Verify JWT signature/type first
    try {
      verifyRefreshToken(oldRefreshToken);
    } catch {
      await this.logAuthAction(
        "AUTH_TOKEN_REFRESH_FAILED",
        undefined,
        { reason: "INVALID_REFRESH_TOKEN_SIGNATURE" },
        auditContext
      );
      throw new UnauthorizedError("Invalid refresh token");
    }

    // 2) Check DB existence
    const storedToken = await this.repo.findRefreshToken(oldRefreshToken);
    if (!storedToken) {
      await this.logAuthAction(
        "AUTH_TOKEN_REFRESH_FAILED",
        undefined,
        { reason: "REFRESH_TOKEN_NOT_FOUND" },
        auditContext
      );
      throw new BadRequestError("Invalid refresh token");
    }

    // 3) If already revoked -> possible reuse
    if (storedToken.revokedAt) {
      const graceMs = 30 * 1000;
      const timeSinceRevoked = Date.now() - storedToken.revokedAt.getTime();

      if (timeSinceRevoked > graceMs) {
        logger.error(
          { userId: storedToken.userId },
          "SECURITY ALERT: Reused refresh token detected. Revoking all tokens."
        );
        await this.logAuthAction(
          "AUTH_TOKEN_REUSE_DETECTED",
          storedToken.userId,
          { revokedAt: storedToken.revokedAt.toISOString() },
          auditContext,
          storedToken.userId
        );
        await this.repo.revokeAllRefreshTokensForUser(storedToken.userId);
        throw new UnauthorizedError("Invalid refresh token");
      }

      // within grace period try replacement
      const newToken = await this.repo.findReplacementRefreshToken(
        storedToken.userId,
        storedToken.revokedAt
      );

      if (newToken) {
        await this.logAuthAction(
          "AUTH_TOKEN_REFRESH_SUCCESS",
          newToken.user.id,
          { viaGraceWindow: true },
          auditContext,
          newToken.user.id
        );
        return {
          accessToken: generateAccessToken({
            id: newToken.user.id,
            email: newToken.user.email,
            username: newToken.user.username,
          }),
          refreshToken: newToken.token,
        };
      }

      throw new UnauthorizedError("Invalid refresh token");
    }

    // 4) Expired
    if (storedToken.expiresAt < new Date()) {
      await this.logAuthAction(
        "AUTH_TOKEN_REFRESH_FAILED",
        storedToken.userId,
        { reason: "REFRESH_TOKEN_EXPIRED" },
        auditContext,
        storedToken.userId
      );
      throw new BadRequestError("Refresh token has expired");
    }

    // 5) Rotate: revoke old, issue new
    await this.repo.revokeRefreshToken(storedToken.token, storedToken.userId);

    const { accessToken, refreshToken } = await this.issueTokens({
      id: storedToken.user.id,
      email: storedToken.user.email,
      username: storedToken.user.username,
    });

    await this.logAuthAction(
      "AUTH_TOKEN_REFRESH_SUCCESS",
      storedToken.user.id,
      { rotated: true },
      auditContext,
      storedToken.user.id
    );

    return { accessToken, refreshToken };
  }

  async revokeRefreshToken(token: string, userId: number, auditContext?: AuditContext) {
    if (!token) throw new UnauthorizedError("refreshToken is required");

    const result = await this.repo.revokeRefreshToken(token, userId);
    if (result.count === 0) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    await this.logAuthAction(
      "AUTH_LOGOUT",
      userId,
      { scope: "single-session" },
      auditContext,
      userId
    );
  }

  async revokeAllUserTokens(userId: number, auditContext?: AuditContext) {
    await this.repo.revokeAllRefreshTokensForUser(userId);
    await this.logAuthAction(
      "AUTH_LOGOUT_ALL",
      userId,
      { scope: "all-sessions" },
      auditContext,
      userId
    );
  }


  // -------------------------
  // Me / Update / Change Password (unchanged from you except minor types)
  // -------------------------
    
  async me(userId: number) {
    const result = await this.repo.getUserProfile(userId);

    if (!result || !result.user) throw new NotFoundError("User not found");

    const { roles, permissions } = this.extractRolesAndPermissions(result.user);

    
    return {
      user: this.buildUserResponse(result.user),
      preferences: result.preferences,
      roles,
      permissions,
    };
  }

  async updateMe(
    userIdToUpdate: number,
    authenticatedUserId: number,
    userData: UpdateMeDto,
    file?: Express.Multer.File,
    auditContext?: AuditContext
  ) {
    if (authenticatedUserId !== userIdToUpdate) {
      throw new ForbiddenError("You can only update your own profile");
    }

    const currentUser = await this.repo.findById(userIdToUpdate);
    if (!currentUser) throw new BadRequestError("User not found");

    const oldProfilePicture = currentUser.profilePicture;

    const profileData: Prisma.UserUpdateInput = {
      ...(userData.profile ?? {}),
    };

    if (!file && Object.keys(profileData).length === 0) {
      throw new BadRequestError("No profile data provided");
    }

    let newProfilePictureUrl: string | undefined;

    if (file) {
      newProfilePictureUrl = await FileUploadService.uploadFile(file, "profile");
      profileData.profilePicture = newProfilePictureUrl;
    }

    try {
      const updated = await this.repo.updateProfile(
        userIdToUpdate,
        profileData,
      );

      if (
        file &&
        oldProfilePicture &&
        newProfilePictureUrl &&
        oldProfilePicture !== newProfilePictureUrl
      ) {
        await FileUploadService.deleteFile(oldProfilePicture);
      }

      const preferences = await this.repo.ensureUserPreferences(userIdToUpdate);
      const { roles, permissions } = this.extractRolesAndPermissions(updated);

      const changedFields = Object.keys(userData.profile ?? {}).filter(
        (key) => (userData.profile as Record<string, unknown>)[key] !== undefined
      );
      if (file) changedFields.push("profilePicture");

      await this.logAuthAction(
        "AUTH_PROFILE_UPDATED",
        userIdToUpdate,
        {
          changedFields: [...new Set(changedFields)],
          hasProfilePictureUpload: Boolean(file),
        },
        auditContext,
        userIdToUpdate
      );

      return {
        user: this.buildUserResponse(updated),
        preferences,
        roles,
        permissions,
      };
    } catch (err) {
      if (newProfilePictureUrl) {
        await FileUploadService.deleteFile(newProfilePictureUrl).catch(() => undefined);
      }
      throw err;
    }
  }

  // Update preferences only
  async updatePreferences(
    userIdToUpdate: number,
    authenticatedUserId: number,
    preferencesData: UpdatePreferencesDto,
    auditContext?: AuditContext
  ) {
    if (authenticatedUserId !== userIdToUpdate) {
      throw new ForbiddenError("You can only update your own preferences");
    }

    const currentUser = await this.repo.findById(userIdToUpdate);
    if (!currentUser) throw new BadRequestError("User not found");

    const prismaPreferencesData: Prisma.UserPreferenceUpdateInput = {
      ...(preferencesData ?? {}),
    };

    const updatedPreferences = await this.repo.updatePreferences(
      userIdToUpdate,
      prismaPreferencesData
    );

    const changedFields = Object.keys(preferencesData ?? {}).filter(
      (key) => (preferencesData as Record<string, unknown>)[key] !== undefined
    );

    await this.logAuthAction(
      "AUTH_PREFERENCES_UPDATED",
      userIdToUpdate,
      { changedFields },
      auditContext,
      userIdToUpdate
    );

    return {
      preferences: updatedPreferences,
    };
  }

 

  async changePassword(
    userId: number,
    newPassword: ChangePasswordDto,
    auditContext?: AuditContext
  ) {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    if (!user.password) {
      throw new BadRequestError("This account uses Google sign-in. Set a password first.");
    }

    const ok = await this.comparePassword(newPassword.currentPassword, user.password);
    if (!ok) throw new BadRequestError("Current password is incorrect");

    const hashedPassword = await bcrypt.hash(newPassword.newPassword, 12);
    await this.repo.updateProfile(userId, { password: hashedPassword });

    await this.repo.revokeAllRefreshTokensForUser(userId);

    await this.logAuthAction(
      "AUTH_PASSWORD_CHANGED",
      userId,
      { revokedAllRefreshTokens: true },
      auditContext,
      userId
    );

    return { message: "Password updated successfully" };
  }

 

  // -----------------------------
  // GOOGLE SSO (register-or-login)
  // Auto-assigns "VIEWER" role to new users
  // -----------------------------
  async googleSSO(idToken: string, auditContext?: AuditContext) {
    if (!idToken) throw new BadRequestError("idToken is required");

    const google = await verifyGoogleIdToken(idToken);

    // Strongly recommended: only allow verified email for account linking/creation
    if (!google.email || google.emailVerified !== true) {
      throw new UnauthorizedError("Google email is not verified or missing");
    }

    // 1) Find existing linked Account
    const existingAccount = await this.repo.findAccount("google", google.sub);

    let user: any;
    let isNewUser = false;

    if (existingAccount) {
      user = existingAccount.user;
    } else {
      // 2) Link by email if user already exists
      const byEmail = await this.repo.findUserByEmail(google.email);

      if (byEmail) {
        user = byEmail;
        
        // If existing user doesn't have any roles, assign default role
        if (!user.roles || user.roles.length === 0) {
          await this.repo.assignDefaultRoleToUser(user.id, user.id);
        }
      } else {
        // 3) Create new user (password null) with default role
        const baseUsername = google.email.split("@")[0];
        const username = await this.generateUniqueUsername(`${baseUsername}`);

        const firstName = google.firstName.trim() || "Google";
        const lastName = google.lastName.trim() || "User";

        // Get the default role (Viewer role with hierarchy level 5)
        const defaultRole = await this.repo.findRoleByCode("VIEWER");
        
        user = await this.repo.createUser({
          email: google.email,
          username,
          password: null,
          firstName,
          lastName,
          profilePicture: google.picture,
          emailVerified: new Date(), // since Google verified email
          status: "ACTIVE",
          roleId: defaultRole?.id || 5, // assign default 'VIEWER' role
          assignedBy: undefined, 
        } as any);

        isNewUser = true;
      }
      // 4) Create Account link (Auth.js-compatible)
      await this.repo.createAccount({
        userId: user.id,
        type: "oauth",
        provider: "google",
        providerAccountId: google.sub,
        idToken,
      });
    }

    if (!user) throw new UnauthorizedError("Authentication failed");
   this.ensureActive(user);
   this.ensureNotLocked(user);

    // Update login state + mark verified if missing
    await this.repo.updateProfile(user.id, {
      lastLogin: new Date(),
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      emailVerified: user.emailVerified ?? new Date(),
      profilePicture: user.profilePicture ?? google.picture,
    }
  );

    const { accessToken, refreshToken } = await this.issueTokens(user as TokenUser)
    const preferences = await this.repo.ensureUserPreferences(user.id);
    await this.logAuthAction(
      isNewUser ? "AUTH_GOOGLE_REGISTERED" : "AUTH_GOOGLE_LOGIN_SUCCESS",
      user.id,
      {
        email: user.email,
        isNewUser,
      },
      auditContext,
      user.id
    );
    return {
      isNewUser,
      accessToken,
      refreshToken,
      user: this.buildUserResponse(user),
      preferences,
    };
  }
}


