import { z } from "zod";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});
export const roleSchema = z.object({
  roleId: z.number().optional(),
  roleName: z.string(),
  roleCode: z.string(),
  isActive: z.boolean().optional(),
  hierarchyLevel: z.number().optional(),
});

export const registerSchema = z
  .object({
    email: z.string().min(1, "Email is required").email("Invalid email"),
    username: z.string().min(1, "Username is required").max(50),
    firstName: z.string().min(1, "First name is required").max(50),
    lastName: z.string().min(1, "Last name is required").max(50),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z
      .string()
      .min(8, "Confirm Password must be at least 8 characters"),
    phone: z.string().max(30).optional().or(z.literal("")),
    profilePicture: z
      .instanceof(File)
      .optional()
      .refine((file) => !file || file.size <= MAX_FILE_SIZE, {
        message: "File size must be less than 5MB",
      })
      .refine((file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), {
        message: "Only .jpg, .jpeg, .png and .webp formats are supported",
      }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const userSchema = z.object({  
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  profilePicture: z.string().url().nullable().optional(),
  phone: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  role: z.string().optional(),
  roles: z.array(roleSchema).default([]),
  permissions: z.array(z.string()).default([]),
});

export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(50)
    .optional(),
  email: z.string().min(1, "Email is required").email("Invalid email"),
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  phone: z.string().max(30).optional().or(z.literal("")),
  bio: z.string().max(500).optional().or(z.literal("")),
  profilePicture: z
    .instanceof(File)
    .optional()
    .refine((file) => !file || file.size <= MAX_FILE_SIZE, {
      message: "File size must be less than 5MB",
    })
    .refine((file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), {
      message: "Only .jpg, .jpeg, .png and .webp formats are supported",
    }),
});

export type AuthMePayload = {
  user: UserPayload;
  preferences?: PreferencesPayload | null;
  roles?: Role[];
  permissions?: string[];
};


export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(8, "Current Password must be at least 8 characters"),
    newPassword: z
      .string()
      .min(8, "New Password must be at least 8 characters")
      .regex(/[0-9]/, "New Password must contain at least one number"),
    confirmPassword: z
      .string()
      .min(8, "Confirm Password must be at least 8 characters"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type User = z.infer<typeof userSchema>;
export type Role = z.infer<typeof roleSchema>;
export type UserPayload = Omit<User, "roles" | "permissions"> & {
  roles?: Role[];
  permissions?: string[];
};
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export type Preferences = {
  theme: "light" | "dark" | "system";
  language: "en" | "kh";
  timezone: string;
  accentColor:
    | "blue"
    | "green"
    | "purple"
    | "orange"
    | "red"
    | "pink"
    | "teal"
    | "cyan";
  borderRadius: "none" | "small" | "medium" | "large" | "full";
  fontFamily: "inter" | "system" | "roboto" | "open-sans" | "poppins";
  fontSize: "small" | "medium" | "large" | "xlarge";
  themePreset: "default" | "ocean" | "forest" | "sunset" | "purple" | "rose";
  themeColor: "default" | "classic" | "amber" | "rose" | "slate" | "violet";
};

export type PreferencesPayload = Partial<{
  theme: Preferences["theme"] | null;
  language: Preferences["language"] | null;
  timezone: string | null;
  accentColor: Preferences["accentColor"] | null;
  borderRadius: Preferences["borderRadius"] | null;
  fontFamily: Preferences["fontFamily"] | null;
  fontSize: Preferences["fontSize"] | null;
  themePreset: Preferences["themePreset"] | null;
  themeColor: Preferences["themeColor"] | null;
}>;
