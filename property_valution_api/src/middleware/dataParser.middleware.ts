// middleware/dateParser.ts
import { Request, Response, NextFunction } from "express";

export const dateParser = (req: Request, res: Response, next: NextFunction) => {
  const parseDates = (obj: any) => {
    if (!obj || typeof obj !== "object") return;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
        obj[key] = new Date(val);
      } else if (typeof val === "object") {
        parseDates(val);
      }
    }
  };
  parseDates(req.body);
  next();
};
