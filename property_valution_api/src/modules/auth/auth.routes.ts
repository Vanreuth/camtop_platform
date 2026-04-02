import { Router } from "express";
import { AuthController} from "./auth.controller";
import { validate, parseJsonFields } from "../../middleware/validation.middleware";
import {
  loginSchema,
  registerSchema,
  refreshSchema,
  changePasswordShema,
  updateProfileSchema,
  updatePreferencesSchema,
  updateMeSchema,
  updateMeProfileSchema,
  resendVerificationSchema,
} from "./auth.dto";
import { authenticate } from "../../middleware/auth.middleware";
import { upload} from "../../middleware/upload.middleware";

export const authRoutes = Router();

authRoutes.post(
  "/register",
  upload.single("profilePicture"),
  validate(registerSchema),
  AuthController.register
);

authRoutes.post("/login", validate(loginSchema), AuthController.login);
authRoutes.post("/google/callback", AuthController.googleOAuthCallback);
authRoutes.post("/logout", authenticate, AuthController.logout);
authRoutes.post("/logoutall", authenticate, AuthController.logoutAll);
authRoutes.get("/me", authenticate, AuthController.me);

authRoutes.patch(
  "/me/profile",
  authenticate,
  upload.single("profilePicture"),
  parseJsonFields(["profile"]),
  validate(updateMeProfileSchema),
  AuthController.updateMe
);

// Update preferences only
authRoutes.patch("/me/preferences", authenticate, validate(updatePreferencesSchema), AuthController.updatePreferences);

authRoutes.post("/refresh", validate(refreshSchema), AuthController.refresh);
authRoutes.patch(
  "/:id/password",
  authenticate,
  validate(changePasswordShema),
  AuthController.changePassword
);

// Verify email (supports both browser link GET and API POST)
authRoutes.get("/verify-email", AuthController.verifyEmail);
authRoutes.post("/verify-email", AuthController.verifyEmail);
authRoutes.post("/resend-verification", validate(resendVerificationSchema), AuthController.resendVerification);
