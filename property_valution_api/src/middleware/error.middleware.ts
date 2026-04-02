import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../common/errors/app.error";
import { logger } from "../config/logger";

type FieldError = { path: string; message: string };

function respondError(
  res: Response,
  statusCode: number,
  message: string,
  code: string,
  errors: FieldError[] = []
) {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
    errors,
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // 1) Zod validation errors
  if (err instanceof ZodError) {
    const errors: FieldError[] = [];

    // Convert Zod issues => [{path,message}]
    for (const issue of err.issues) {
      errors.push({
        path: issue.path.join(".") || "body",
        message: issue.message,
      });
    }

    logger.warn(
      { path: req.originalUrl, method: req.method, errors },
      "Validation error (Zod)"
    );

    return respondError(res, 400, "Validation error", "VALIDATION_ERROR", errors);
  }

  // 2) Joi validation errors
  if (typeof err === "object" && err !== null && (err as any).isJoi) {
    const details = (err as any).details ?? [];
    const errors: FieldError[] = details.map((d: any) => ({
      path: Array.isArray(d.path) ? d.path.join(".") : String(d.path ?? "body"),
      message: String(d.message ?? "Validation error"),
    }));

    logger.warn(
      { path: req.originalUrl, method: req.method, errors },
      "Validation error (Joi)"
    );

    return respondError(res, 400, "Validation error", "VALIDATION_ERROR", errors);
  }

  // 3) Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error(
      {
        path: req.originalUrl,
        method: req.method,
        prismaCode: err.code,
        meta: err.meta,
      },
      "Prisma known request error"
    );

    // Unique constraint
    if (err.code === "P2002") {
      const target = (err.meta as any)?.target;
      const field = Array.isArray(target) ? target.join(",") : String(target ?? "unique");

      return respondError(
        res,
        409,
        `${field} already exists`,
        "DUPLICATE",
        [{ path: field, message: "Already exists" }]
      );
    }

    return respondError(res, 400, "Database request error", "DB_REQUEST_ERROR");
  }

  // 4) Prisma validation errors (bad query shape, missing field, etc.)
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error(
      { path: req.originalUrl, method: req.method, error: err.message },
      "Prisma validation error"
    );

    return respondError(res, 400, "Database validation error", "DB_VALIDATION_ERROR");
  }

  // 5) Your known AppError (business errors)
  if (err instanceof AppError) {
    logger.warn(
      {
        path: req.originalUrl,
        method: req.method,
        code: err.code,
        statusCode: err.statusCode,
        errors: err.errors ?? [],
      },
      "Handled application error"
    );

    return respondError(
      res,
      err.statusCode,
      err.message,
      err.code,
      err.errors ?? []
    );
  }

  // 6) Unknown error
  logger.fatal(
    {
      path: req.originalUrl,
      method: req.method,
      err,
    },
    "Unhandled server error"
  );

  return respondError(res, 500, "Internal server error", "INTERNAL_ERROR");
}
