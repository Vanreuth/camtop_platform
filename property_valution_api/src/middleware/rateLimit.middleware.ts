import rateLimit from "express-rate-limit";
import config from "../config";

const isProduction = config.server.nodeEnv === "production";

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: isProduction ? 300 : 0, // 0 = disabled in dev for convenience
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  skip: () => !isProduction,
});

export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: isProduction ? 20 : 0,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
  skip: () => !isProduction,
});