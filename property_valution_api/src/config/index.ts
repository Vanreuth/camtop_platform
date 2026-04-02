import { env } from "./env";

export const config = {
  server: {
    timezone: env.TZ,
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    corsOrigins: env.CORS_ORIGINS,
    trustProxy: env.TRUST_PROXY,
  },

  database: {
    url: env.DATABASE_URL,
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    name: env.POSTGRES_DB,
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN || "15m",
    refreshSecret: env.JWT_REFRESH_SECRET,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  cloudflare: {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY,
    bucketName: env.CLOUDFLARE_BUCKET_NAME,
    publicUrl: env.CLOUDFLARE_R2_PUBLIC_URL,
    region: env.CLOUDFLARE_BUCKET_REGION,
  },

  googleMaps: {
    geocodingApiKey: env.GOOGLE_GEOCODING_API_KEY ?? env.GOOGLE_MAP_API_KEY,
  },
  email: {
    provider: env.EMAIL_PROVIDER,
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
    from: env.EMAIL_FROM,
    resendApiKey: env.RESEND_API_KEY,
  },
};

export default config;
