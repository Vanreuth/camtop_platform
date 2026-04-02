import { Router } from "express";
import { AuditController } from "./audit.controller";
import {
  authenticate,
  authorize,
  authorizeAny,
  superAdminOnly,
} from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get(
  "/logs",
  authorizeAny(3, ["audit:manage", "audit:read"]),
  AuditController.getAuditLogs
);

router.get(
  "/logs/:userId",
  authorizeAny(3, ["audit:manage", "audit:read"]),
  AuditController.getUserAuditLogs
);

router.get(
  "/summary",
  authorizeAny(3, ["audit:manage", "audit:read"]),
  AuditController.getAuditSummary
);

router.post("/log", authorize(3, ["audit:manage"]), AuditController.logAction);
router.post("/login", authorize(3, ["audit:manage"]), AuditController.logLoginSession);

router.delete("/cleanup", superAdminOnly(), AuditController.cleanup);

export default router;

