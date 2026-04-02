import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import type { AuthRequest } from "../../common/types/auth.type";
import { durationToMs } from "../../common/utils/duration"; 
import config from "../../config";
import {successResponse,errorResponse} from "../../common/utils/responseHelper";
import { logger } from "../../config/logger";

const isProd = process.env.NODE_ENV === "production";

const ACCESS_COOKIE_NAME = "accessToken";
const REFRESH_COOKIE_NAME = "refreshToken";

// If frontend and backend are different domains, use "none" + secure:true in prod
const SAME_SITE = isProd ? ("none" as const) : ("lax" as const);


function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,         // must be true in production if sameSite="none"
    sameSite: SAME_SITE,
    path: "/", // allow refresh token to be sent to /logout and other auth endpoints
  };
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,                       
   sameSite: (isProd ? "none" : "lax") as "none" | "lax", // prod cross-site requires "none"
    path: "/",                             // keep "/" for middleware checks
  };
}

function accessCookieMaxAge() {
  return durationToMs(config.jwt.expiresIn ?? "15m", 15 * 60 * 1000);
}

function refreshCookieMaxAge() {
  return durationToMs(config.jwt.refreshExpiresIn ?? "7d", 7 * 24 * 60 * 60 * 1000);
}

export class AuthController {

  private static service = new AuthService();
  private static getAuditContext(req: Request) {
    const forwardedFor = req.headers["x-forwarded-for"];
    const ipAddress =
      (typeof forwardedFor === "string"
        ? forwardedFor.split(",")[0]?.trim()
        : undefined) ||
      req.ip ||
      req.socket.remoteAddress ||
      undefined;

    const userAgentHeader = req.headers["user-agent"];
    const userAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader.join(", ")
      : userAgentHeader;

    return { ipAddress, userAgent };
  }
  static async register(req: Request, res: Response) {
      const result = await AuthController.service.register(
        req.body,
        req.file,
        AuthController.getAuditContext(req)
      );
      const message = result.verificationEmailSent
        ? "Registration successful. Please verify your email."
        : "Registration successful, but verification email could not be sent. Please resend verification.";
      return successResponse(
        res,
        201,
        result,
        message
      );
  }

  static async login(req: Request, res: Response) {
    const result = await AuthController.service.login(
      req.body,
      AuthController.getAuditContext(req)
    );

    res.cookie(ACCESS_COOKIE_NAME, result.accessToken, {
      ...cookieOptions(),
      maxAge: accessCookieMaxAge(),
    });

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...refreshCookieOptions(),
      maxAge: refreshCookieMaxAge(),
    });

    const { refreshToken, ...safe } = result;


    return successResponse(
      res,
      200,
      safe,
      "Login successful"
    );
  }

  static async me(req: AuthRequest, res: Response) {
    if (!req.user?.id) {
      return errorResponse(res, 401, "Unauthorized");
    }

    const data = await AuthController.service.me(req.user.id);
    return successResponse(res, 200, data, "User profile fetched successfully");
  }

  static async refresh(req: Request, res: Response) {
    const refreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
     return errorResponse(res, 401, "Refresh token is required");
    }

    const data = await AuthController.service.refreshAccessToken(
      refreshToken,
      AuthController.getAuditContext(req)
    );

    res.cookie(ACCESS_COOKIE_NAME, data.accessToken, {
      ...cookieOptions(),
      maxAge: accessCookieMaxAge(),
    });

    if (data.refreshToken) {
      res.cookie(REFRESH_COOKIE_NAME, data.refreshToken, {
        ...refreshCookieOptions(),
        maxAge: refreshCookieMaxAge(),
      });
    }
    return successResponse(res, 200, {accessToken: data.accessToken}, "Access token refreshed successfully");
  }

  static async logout(req: AuthRequest, res: Response) {
    const userId = req.user?.id;

    // Get refresh token from cookie or body
    const refreshToken =
      req.cookies?.[REFRESH_COOKIE_NAME];

    // Revoke token from database if available
    if (refreshToken) {
      await AuthController.service.revokeRefreshToken(
        refreshToken,
        Number(userId),
        AuthController.getAuditContext(req)
      );
    }

    res.clearCookie(ACCESS_COOKIE_NAME, cookieOptions());
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());

    return successResponse(res, 200, null, "Logout successful");
  }

  static async logoutAll(req: AuthRequest, res: Response) {
    const userId = req.user?.id;
    await AuthController.service.revokeAllUserTokens(
      Number(userId),
      AuthController.getAuditContext(req)
    );

    res.clearCookie(ACCESS_COOKIE_NAME, cookieOptions());
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());

    return successResponse(res, 200, null, "Logout all successful");
  }

  static async updateMe(req: AuthRequest, res: Response) {
    if (!req.user?.id) {
      return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    const id = req.user.id;
    
    const result = await AuthController.service.updateMe(
      id, // userIdToUpdate
      id, // authenticatedUserId
      req.body, // UpdateMeDto
      req.file, // uploaded file
      AuthController.getAuditContext(req)
    );

    return successResponse(res, 200, result, "Profile updated successfully");
  }

  static async updatePreferences(req: AuthRequest, res: Response) {
    if (!req.user?.id) {
      return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    const id = req.user.id;
    const result = await AuthController.service.updatePreferences(
      id, // userIdToUpdate
      id, // authenticatedUserId
      req.body, // UpdatePreferencesDto (flat)
      AuthController.getAuditContext(req)
    );

    return successResponse(res, 200, result, "Preferences updated successfully");
  }

  static async changePassword(req: AuthRequest, res: Response) {
    if (!req.user?.id) {
      return res.status(401).json({ status: false, message: "Unauthorized" });
    }

    const data = await AuthController.service.changePassword(
      req.user.id,
      req.body,
      AuthController.getAuditContext(req)
    );

    res.clearCookie(ACCESS_COOKIE_NAME, cookieOptions());
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());

    return successResponse(res, 200, data, "Password changed successfully");
  }

  static async googleOAuthCallback(req: Request, res: Response) {
  const { idToken } = req.body;
  const data = await AuthController.service.googleSSO(
    idToken,
    AuthController.getAuditContext(req)
  );

  res.cookie(ACCESS_COOKIE_NAME, data.accessToken, {
    ...cookieOptions(),
    maxAge: accessCookieMaxAge(),
  });

  res.cookie(REFRESH_COOKIE_NAME, data.refreshToken, {
    ...refreshCookieOptions(),
    maxAge: refreshCookieMaxAge(),
  });

  const message = data.isNewUser
    ? "Account created and logged in via Google successfully"
    : "Login via Google successful";

  return successResponse(res, 200, data, message);
}


  // -------- Email verification endpoints (Option A) --------
  // POST /api/auth/verify-email
static async verifyEmail(req: Request, res: Response) {
  try {
    // Check if client wants HTML response (browser) or JSON (API)
    const wantsHtml =
      typeof req.headers.accept === "string" &&
      req.headers.accept.includes("text/html");

    const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    
    // Helper function to escape HTML (prevent XSS)
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (ch) => {
        const entities: Record<string, string> = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        };
        return entities[ch] || ch;
      });

    // Accept token from query params (GET) or body (POST)
    const tokenCandidate =
      (typeof req.query?.token === "string" ? req.query.token : undefined) ??
      (typeof req.body?.token === "string" ? req.body.token : undefined);
    const token = tokenCandidate?.trim();
    
    // Validate token exists
    if (!token) {
      if (wantsHtml) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Verification Failed</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  padding: 20px;
                }
                .container { 
                  background: white; 
                  padding: 40px; 
                  border-radius: 12px; 
                  max-width: 500px; 
                  width: 100%;
                  margin: 0 auto; 
                  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                  text-align: center;
                }
                .icon { font-size: 64px; margin-bottom: 20px; }
                .error { color: #dc3545; }
                h2 { color: #333; margin: 10px 0 20px; font-size: 24px; }
                p { color: #666; line-height: 1.6; margin-bottom: 20px; }
                .button { 
                  display: inline-block;
                  background: #667eea; 
                  color: white; 
                  padding: 14px 30px; 
                  border-radius: 8px; 
                  text-decoration: none; 
                  font-weight: 600;
                  transition: all 0.3s ease;
                }
                .button:hover { 
                  background: #5568d3; 
                  transform: translateY(-2px);
                  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="icon error">✗</div>
                <h2>Invalid Verification Link</h2>
                <p>The verification link is invalid or missing the required token.</p>
                <a class="button" href="${escapeHtml(frontendBaseUrl)}">Go to Home</a>
              </div>
            </body>
          </html>
        `);
      }

      return res.status(400).json({ 
        success: false,
        message: "Verification token is required" 
      });
    }

    // Verify the token
    const result = await AuthController.service.verifyEmail(
      token,
      AuthController.getAuditContext(req)
    );

    // Return HTML for browser requests
    if (wantsHtml) {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Email Verified Successfully</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 20px;
              }
              .container { 
                background: white; 
                padding: 40px; 
                border-radius: 12px; 
                max-width: 500px; 
                width: 100%;
                margin: 0 auto; 
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                text-align: center;
              }
              .icon { 
                font-size: 64px; 
                margin-bottom: 20px;
                animation: scaleIn 0.5s ease-out;
              }
              @keyframes scaleIn {
                0% { transform: scale(0); }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); }
              }
              .success { color: #28a745; }
              h2 { color: #333; margin: 10px 0 20px; font-size: 24px; }
              p { color: #666; line-height: 1.6; margin-bottom: 20px; }
              .info { 
                background: #e7f3ff; 
                border-left: 4px solid #2196F3; 
                padding: 12px; 
                margin: 20px 0;
                text-align: left;
                border-radius: 4px;
              }
              .button { 
                display: inline-block;
                background: #667eea; 
                color: white; 
                padding: 14px 32px; 
                border-radius: 8px; 
                text-decoration: none; 
                font-weight: 600;
                transition: all 0.3s ease;
                margin-top: 10px;
              }
              .button:hover { 
                background: #5568d3; 
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
              }
              .countdown {
                color: #999;
                font-size: 14px;
                margin-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon success">✓</div>
              <h2>Email Verified Successfully!</h2>
              <p>Your account is now active and ready to use.</p>
              
              <div class="info">
                <strong>✓ Email verified</strong><br/>
                <strong>✓ Account activated</strong><br/>
                <strong>✓ All features unlocked</strong>
              </div>
              
              <a class="button" href="${escapeHtml(frontendBaseUrl)}/login">Go to Login</a>
              
              <p class="countdown">Redirecting to login in <span id="countdown">5</span> seconds...</p>
            </div>
            
            <script>
              // Auto-redirect after 5 seconds
              let seconds = 5;
              const countdownEl = document.getElementById('countdown');
              
              const interval = setInterval(() => {
                seconds--;
                if (countdownEl) countdownEl.textContent = seconds.toString();
                
                if (seconds <= 0) {
                  clearInterval(interval);
                  window.location.href = '${escapeHtml(frontendBaseUrl)}/login';
                }
              }, 1000);
            </script>
          </body>
        </html>
      `);
    }

    // Return JSON for API requests
      return res.status(200).json({
        success: true,
        ...result,
      });
    
  } catch (error) {
    const wantsHtml =
      typeof req.headers.accept === "string" &&
      req.headers.accept.includes("text/html");
    
    const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (ch) => {
        const entities: Record<string, string> = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        };
        return entities[ch] || ch;
      });

    const message = error instanceof Error ? error.message : "Verification failed";

    if (wantsHtml) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Verification Failed</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 20px;
              }
              .container { 
                background: white; 
                padding: 40px; 
                border-radius: 12px; 
                max-width: 500px; 
                width: 100%;
                margin: 0 auto; 
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                text-align: center;
              }
              .icon { font-size: 64px; margin-bottom: 20px; }
              .error { color: #dc3545; }
              h2 { color: #333; margin: 10px 0 20px; font-size: 24px; }
              p { color: #666; line-height: 1.6; margin-bottom: 20px; }
              .error-box {
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 12px;
                margin: 20px 0;
                text-align: left;
                border-radius: 4px;
              }
              .button { 
                display: inline-block;
                background: #667eea; 
                color: white; 
                padding: 14px 30px; 
                border-radius: 8px; 
                text-decoration: none; 
                font-weight: 600;
                transition: all 0.3s ease;
                margin: 10px 5px;
              }
              .button:hover { 
                background: #5568d3; 
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
              }
              .button-secondary {
                background: #6c757d;
              }
              .button-secondary:hover {
                background: #5a6268;
                box-shadow: 0 4px 12px rgba(108, 117, 125, 0.4);
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon error">✗</div>
              <h2>Verification Failed</h2>
              
              <div class="error-box">
                <strong>Error:</strong> ${escapeHtml(message)}
              </div>
              
              <p>The verification link may have expired or already been used.</p>
              
              <a class="button" href="${escapeHtml(frontendBaseUrl)}/resend-verification">Request New Link</a>
              <a class="button button-secondary" href="${escapeHtml(frontendBaseUrl)}">Go to Home</a>
            </div>
          </body>
        </html>
      `);
    }

    return res.status(400).json({ 
      success: false,
      message,
    });
  }
}

  // POST /api/auth/resend-verification
  static async resendVerification(req: Request, res: Response) {
    try {
      const { email } = req.body;

      const result = await AuthController.service.resendVerificationEmail(
        email,
        AuthController.getAuditContext(req)
      );
      return successResponse(res, 200, result, "Verification email resent successfully");
    } catch (error) {
      logger.error({ err: error }, "Failed to resend verification email");
      const message =
        error instanceof Error
          ? error.message
          : "Failed to resend verification email";
      return errorResponse(res, 400, message);
    }
  }
}
