import { Response, NextFunction } from "express";
import { AuthRequest } from "../common/types/auth.type";
import { verifyAccessToken } from "../common/utils/jwt";
import { prisma } from "../db/prisma";
import { UnauthorizedError } from "../common/errors/unauthorzed.error";
import { AuthService } from "../modules/auth/auth.service";
import { durationToMs } from "../common/utils/duration";
import config from "../config";


const authService = new AuthService();

const isProd = process.env.NODE_ENV === "production";

// Use the same cookie options as your controller to ensure overwrite works
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/",
};

function accessCookieMaxAge() {
  return durationToMs(config.jwt.expiresIn ?? "15m", 15 * 60 * 1000);
}

function refreshCookieMaxAge() {
  return durationToMs(config.jwt.refreshExpiresIn ?? "7d", 7 * 24 * 60 * 60 * 1000);
}

// Verify access token and attach user with roles & permissions to request
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let accessToken = req.cookies?.accessToken;
  let userId : number | null = null;
  
  // ------------------------------------------------------------------
  // STEP 1: Try to verify the Access Token
  // ------------------------------------------------------------------
  if (accessToken) {
    try {
      const decoded = verifyAccessToken(accessToken);
      userId = decoded.id;
    } catch (error) {
      // If token is expired or invalid, we set accessToken to null
      // so we fall through to the refresh logic below.
      accessToken = null;
    }
  }

  // ------------------------------------------------------------------
  // STEP 2: Auto-Refresh if Access Token is missing or expired
  // ------------------------------------------------------------------
  if (!accessToken) {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        status: false,
        error: "Authentication required",
        message: "No access or refresh token provided",
      });
    }

    try {
      // Attempt to refresh tokens using your existing Service logic
      const userAgentHeader = req.headers["user-agent"];
      const newTokens = await authService.refreshAccessToken(refreshToken, {
        ipAddress: req.ip ?? req.socket.remoteAddress ?? undefined,
        userAgent: Array.isArray(userAgentHeader)
          ? userAgentHeader.join(", ")
          : userAgentHeader,
      });

      // ✅ SET NEW COOKIES: This updates the browser immediately
      res.cookie("accessToken", newTokens.accessToken, {
        ...cookieOptions,
        maxAge: accessCookieMaxAge(),
      });

      if (newTokens.refreshToken) {
        res.cookie("refreshToken", newTokens.refreshToken, {
          ...cookieOptions,
          maxAge: refreshCookieMaxAge(),
        });
      }

      // Decode the NEW access token to get the user ID
      const decoded = verifyAccessToken(newTokens.accessToken);
      userId = decoded.id;
      
    } catch (refreshError) {
      // If refresh fails (token revoked/expired), clear cookies and fail
      res.clearCookie("accessToken", cookieOptions);
      res.clearCookie("refreshToken", cookieOptions);
      
      return res.status(401).json({
        status: false,
        error: "Session expired",
        message: "Please log in again",
      });
    }
  }

  // ------------------------------------------------------------------
  // STEP 3: Retrieve User & Permissions (Your Original Logic)
  // ------------------------------------------------------------------
  if (!userId) {
     return res.status(401).json({ status: false, message: "Unauthorized" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        status: false,
        error: "User not found",
        message: "The user account associated with this token does not exist",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(401).json({
        status: false,
        error: "Account inactive",
        message: "Your account is not active. Please contact support.",
      });
    }

    const roles = user.roles.map((userRole) => ({
      id: userRole.role.id,
      roleCode: userRole.role.roleCode,
      roleName: userRole.role.roleName,
      hierarchyLevel: userRole.role.hierarchyLevel,
      isActive: userRole.role.isActive,
    }));

    const activeRoles = roles.filter((r) => r.isActive);
    if (activeRoles.length === 0) {
      return res.status(401).json({
        status: false,
        error: "No active roles",
        message: "Your account does not have any active roles.",
      });
    }

    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((p) => p.permission.permissionCode)
    );

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      status: user.status,
      roles: activeRoles,
      permissions: [...new Set(permissions)],
    };

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({
      status: false,
      error: "Internal Server Error",
      message: "An error occurred while authenticating user",
    });
  }
};


interface AuthorizeOptions {
  requiredAllPermissions?: boolean;
  requireRole?: boolean;
  errorMessage?: string;
}

// AUTHORIZATION Middleware
export const authorize = (
  requiredLevel: number,
  requiredPermissions: string[] = [],
  options?: AuthorizeOptions
) => {
  const {
    requiredAllPermissions = true,
    requireRole = true,
    errorMessage,
  } = options || {};

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: false,
          error: "Authentication required",
          message: "You must be logged in to access this resource.",
        });
      }

      // ✅ Check if user has any roles
      if (!req.user.roles || req.user.roles.length === 0) {
        return res.status(403).json({
          status: false,
          error: "No roles assigned",
          message:
            "Your account has no roles assigned. Please contact support.",
        });
      }

      // ✅ Check role hierarchy
      if (requireRole) {
        const hasRequiredRole = req.user.roles.some(
          (role) => role.hierarchyLevel <= requiredLevel
        );

        if (!hasRequiredRole) {
          const currentHighestLevel = Math.min(
            ...req.user.roles.map((r) => r.hierarchyLevel)
          );

          return res.status(403).json({
            status: false,
            error: "Insufficient role privileges",
            message:
              errorMessage ||
              `This action requires role hierarchy level ${requiredLevel} or higher`,
            details: {
              required: { hierarchyLevel: requiredLevel },
              current: {
                highestLevel: currentHighestLevel,
                roles: req.user.roles.map((r) => r.roleCode),
              },
            },
          });
        }
      }
      // ✅ Check permissions (if any specified)
      if (requiredPermissions.length > 0) {
        if (!req.user.permissions || req.user.permissions.length === 0) {
          return res.status(403).json({
            status: false,
            error: "No permissions assigned",
            message: "Your account has no permissions assigned",
          });
        }

        const userPermissions = new Set(req.user.permissions);

        const hasPermissions = requiredAllPermissions
          ? requiredPermissions.every((p) => userPermissions.has(p))
          : requiredPermissions.some((p) => userPermissions.has(p));

        if (!hasPermissions) {
          const missingPermissions = requiredPermissions.filter(
            (p) => !userPermissions.has(p)
          );

          return res.status(403).json({
            status: false,
            error: "Insufficient permissions",
            message:
              errorMessage ||
              `You do not have the required permissions to perform this action`,
            details: {
              required: requiredPermissions,
              missing: missingPermissions,
              mode: requiredAllPermissions ? "ALL required" : "ANY required",
            },
          });
        }
      }

      // ✅ Authorization successful
      next();
    } catch (error) {
      console.error("Authorization error:", error);
      return res.status(500).json({
        status: false,
        error: "Authorization check failed",
        message: "An error occurred while checking your permissions",
      });
    }
  };
};

// Require all specified permissions
export const authorizeAny = (
  requiredLevel: number,
  requiredPermissions: string[],
  errorMessage?: string
) => {
  return authorize(requiredLevel, requiredPermissions, {
    requiredAllPermissions: false,
    errorMessage,
  });
};

// Check only for role hierarchy without permissions
export const authorizeRole = (requiredLevel: number, errorMessage?: string) => {
  return authorize(requiredLevel, [], {
    requireRole: true,
    errorMessage,
  });
};

/**
 * Check only permissions without role hierarchy check
 */
export const authorizePermissions = (
  requiredPermissions: string[],
  requireAll: boolean = true,
  errorMessage?: string
) => {
  return authorize(Infinity, requiredPermissions, {
    requireRole: false,
    requiredAllPermissions: requireAll,
    errorMessage,
  });
};

/**
 * Allow access only to Super Administrators (hierarchy level 1)
 */
export const superAdminOnly = (errorMessage?: string) => {
  return authorizeAny(
    1,
    ["roles:manage", "role:update", "permission:manage", "role:manage"],
    errorMessage || "This action is restricted to Super Administrators only"
  );
};
