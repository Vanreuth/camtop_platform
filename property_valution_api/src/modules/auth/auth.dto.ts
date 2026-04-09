import { z } from "zod";

const passwordSchema = z.string().min(6).max(30);

const emailSchema = z.string().email().toLowerCase().trim().max(255);

const usernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

const nameSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-zA-Z]+$/, "Name can only contain letters")
  .trim();

export const registerSchema = z
  .object({
    email: emailSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    username: usernameSchema,
    phone: z.string().min(10).max(15).optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const changePasswordShema = z
  .object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
    confirmPassword: passwordSchema.optional(),
    confirmNewPassword: passwordSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const confirmPassword = data.confirmPassword ?? data.confirmNewPassword;

    if (!confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Confirm password is required",
        path: ["confirmPassword"],
      });
      return;
    }

    if (
      data.confirmPassword &&
      data.confirmNewPassword &&
      data.confirmPassword !== data.confirmNewPassword
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Confirm password fields do not match",
        path: ["confirmPassword"],
      });
      return;
    }

    if (data.newPassword !== confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "New passwords do not match",
        path: [data.confirmPassword ? "confirmPassword" : "confirmNewPassword"],
      });
    }
  })
  .transform((data) => ({
    currentPassword: data.currentPassword,
    newPassword: data.newPassword,
    confirmPassword: data.confirmPassword ?? data.confirmNewPassword!,
  }));

export const updateProfileSchema = z.object({
  email: emailSchema.optional(),
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  username: usernameSchema.optional(),
  phone: z.string().min(10).max(15).optional(),
  bio: z.string().max(2000).optional(),
}).strict();

export const updatePreferencesSchema = z.object({
  theme: z.string().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  accentColor: z.string().optional(),
  borderRadius: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(),
  themePreset: z.string().optional(),
  themeColor: z.string().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one preference field is required",
}).strict();

// For /me/profile endpoint: allow ONLY `profile` (file upload handled separately)
// Note: Don't use .strict() here because multer file uploads may leave traces in req.body
export const updateMeProfileSchema = z
  .object({
    profile: updateProfileSchema.optional(),
  });

export const updateMeSchema = z
  .object({
    profile: updateProfileSchema.optional(),
    preferences: updatePreferencesSchema.optional(),
  })
  .refine((data) => data.profile || data.preferences, {
    message: "At least one of profile or preferences is required",
  });

export type ChangePasswordDto = z.infer<typeof changePasswordShema>;

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type UpdatePreferencesDto = z.infer<typeof updatePreferencesSchema>;
export type UpdateMeDto = z.infer<typeof updateMeSchema>;

export type UpdateMeProfileDto = z.infer<typeof updateMeProfileSchema>;

export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required").optional(),
});

export type RefreshDto = z.infer<typeof refreshSchema>;

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type ResendVerificationDto = z.infer<typeof resendVerificationSchema>;
