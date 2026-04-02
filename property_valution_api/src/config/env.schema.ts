import { z } from "zod";

export const envSchema = z
  .object({
    // Core
    TZ: z.string().default("Asia/Phnom_Penh"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3600),
    CORS_ORIGINS: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
    APP_URL: z.string().optional(),
    FRONTEND_URL: z.string().optional(),

    // Database
    DATABASE_URL: z.string().min(1),
    POSTGRES_HOST: z.string().default("localhost"),
    POSTGRES_PORT: z.coerce.number().default(5432),
    POSTGRES_USER: z.string().default("postgres"),
    POSTGRES_PASSWORD: z.string().default(""),
    POSTGRES_DB: z.string().default("property_valuation_db"),

    // JWT
    JWT_SECRET: z.string().min(1),
    JWT_EXPIRES_IN: z.string().optional(),
    JWT_REFRESH_SECRET: z.string().min(1),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

    // Cloudflare R2
    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
    CLOUDFLARE_ACCESS_KEY_ID: z.string().optional(),
    CLOUDFLARE_SECRET_ACCESS_KEY: z.string().optional(),
    CLOUDFLARE_BUCKET_NAME: z.string().optional(),
    CLOUDFLARE_R2_PUBLIC_URL: z.string().optional(),
    CLOUDFLARE_BUCKET_REGION: z.string().default("auto"),

    // Google Maps / Geocoding
    GOOGLE_GEOCODING_API_KEY: z.string().optional(),
    // Legacy fallback during migration
    GOOGLE_MAP_API_KEY: z.string().optional(),
    // Google OAuth (id_token audience validation)
    GOOGLE_CLIENT_ID: z.string().optional(),
    // Optional comma-separated list of accepted audiences
    GOOGLE_CLIENT_IDS: z.string().optional(),

    // Email
    EMAIL_PROVIDER: z.enum(["smtp", "resend"]).default("smtp"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    EMAIL_USER: z.string().email().optional(),
    EMAIL_PASS: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    EMAIL_VERIFY_LINK_TARGET: z.enum(["backend", "frontend"]).default("backend"),
    RESEND_API_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production") {
      if (!env.APP_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["APP_URL"],
          message: "APP_URL is required in production",
        });
      }
      if (!env.FRONTEND_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["FRONTEND_URL"],
          message: "FRONTEND_URL is required in production",
        });
      }
    }

    if (env.EMAIL_PROVIDER === "smtp") {
      if (!env.EMAIL_USER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["EMAIL_USER"],
          message: "EMAIL_USER is required when EMAIL_PROVIDER=smtp",
        });
      }
      if (!env.EMAIL_PASS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["EMAIL_PASS"],
          message: "EMAIL_PASS is required when EMAIL_PROVIDER=smtp",
        });
      }
    }

    if (env.EMAIL_PROVIDER === "resend") {
      if (!env.RESEND_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["RESEND_API_KEY"],
          message: "RESEND_API_KEY is required when EMAIL_PROVIDER=resend",
        });
      }
      if (!env.EMAIL_FROM && !env.EMAIL_USER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["EMAIL_FROM"],
          message: "EMAIL_FROM (or EMAIL_USER fallback) is required when EMAIL_PROVIDER=resend",
        });
      }
    }
  });
