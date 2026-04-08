import { Router } from "express";
import { authenticate, authorizeAny } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { downloadReport, generateReport, listReports } from "./report.controller";
import {
  createReportSchema,
  reportIdParamSchema,
  reportListQuerySchema,
} from "./report.dto";

export const reportRoutes = Router();

reportRoutes.use(authenticate);

reportRoutes.get(
  "/",
  authorizeAny(3, ["property:read", "dashboard:read", "user:read", "user:manage"]),
  validate(reportListQuerySchema, "query"),
  listReports
);

reportRoutes.post(
  "/generate",
  authorizeAny(3, ["property:read", "dashboard:read", "user:read", "user:manage"]),
  validate(createReportSchema),
  generateReport
);

reportRoutes.get(
  "/:id/download",
  authorizeAny(3, ["property:read", "dashboard:read", "user:read", "user:manage"]),
  validate(reportIdParamSchema, "params"),
  downloadReport
);
