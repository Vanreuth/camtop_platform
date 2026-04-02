import { Request, Response, NextFunction } from "express";
import { ZodError, ZodSchema } from "zod";

type validationSource = "body" | "query" | "params";

// Middleware to parse JSON strings in FormData fields
export const parseJsonFields = (fields: string[]) => 
  (req: Request, res: Response, next: NextFunction) => {
    try {
      for (const field of fields) {
        if (req.body[field] && typeof req.body[field] === 'string') {
          try {
            req.body[field] = JSON.parse(req.body[field]);
          } catch (e) {
            // If parsing fails, leave as is and let validation handle it
          }
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };

export const validate =
  (schema: ZodSchema<any>, source: validationSource = "body") =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse and validate the combined request data
      const parsed = schema.parse(req[source]);
      // Persist sanitized/coerced result so downstream logic uses validated data.
      // Express 5 exposes `req.query` as a getter-only property, so direct assignment can throw.
      try {
        (req as any)[source] = parsed;
      } catch {
        Object.defineProperty(req, source, {
          value: parsed,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
      // If validation is successful, proceed to the route handler
      next();
    } catch (error) {
      // Check if the error is a Zod validation error
      if (error instanceof ZodError) {
        // Format the errors for a clear client response
        const formattedErrors = error.issues.map((err) => ({
          path: err.path.join("."),
          message: err.message,
        }));

        return res.status(400).json({
          message: "Validation failed",
          errors: formattedErrors,
        });
      }

      // For any other kind of error, pass it to the default error handler
      next(error);
    }
  };

export const validateRequest = validate;
