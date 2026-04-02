import express, { Express, Request, Response, NextFunction } from "express";
import rootRoutes from "./routes";
import { errorHandler } from "./middleware/error.middleware";
import cookieParser from "cookie-parser";
import { dateParser } from "./middleware/dataParser.middleware";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import hpp from "hpp";
import config from "./config";
import { logger } from "./config/logger";
import { generalLimiter, authLimiter } from "./middleware/rateLimit.middleware";

// Initialize event listeners once
import "./events/listeners/propertyEventListeners";

export const app: Express = express();

// Disable framework fingerprinting
app.disable("x-powered-by");

// Reverse proxy trust only in production
if (config.server.nodeEnv === "production") {
  app.set("trust proxy", config.server.trustProxy);
}

// -------------------------
// CORS
// -------------------------
const allowedOrigins = new Set(
  config.server.corsOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const allowAllOrigins = allowedOrigins.has("*");

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server, curl, Postman, internal health checks
    if (!origin) return callback(null, true);

    if (allowAllOrigins || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    logger.warn({ origin }, "Blocked by CORS");
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// -------------------------
// Security headers
// -------------------------
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // enable later if you fully control frontend asset sources
    hsts: config.server.nodeEnv === "production",
  })
);

// Prevent HTTP parameter pollution
app.use(hpp());

// -------------------------
// Body parsing
// -------------------------
app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

app.use(cookieParser());
app.use(dateParser);

// -------------------------
// Rate limiting
// -------------------------
app.use("/api", generalLimiter);
app.use("/api/auth", authLimiter);

// -------------------------
// Health / root
// -------------------------
app.get("/", (_req: Request, res: Response) => {
  res.status(200).send("Hello Camtop Property Valuation API!");
});

app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    env: config.server.nodeEnv,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// -------------------------
// API routes
// -------------------------
app.use("/api", rootRoutes);

// -------------------------
// 404 handler
// -------------------------
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// -------------------------
// Error middleware
// -------------------------
app.use(
  (err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof Error && err.message === "Not allowed by CORS") {
      return res.status(403).json({
        success: false,
        message: "CORS origin denied",
      });
    }
    return next(err);
  }
);

app.use(errorHandler);
