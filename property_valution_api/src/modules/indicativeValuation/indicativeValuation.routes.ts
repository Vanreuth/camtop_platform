import { Router } from "express";
import { authenticate, authorizeAny } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { upload } from "../../middleware/upload.middleware";
import parseJsonFields from "../../middleware/jsonParse.middleware";
import {
  createIndicativeComponentSchema,
  createIndicativeValuationSchema,
  updateIndicativeComponentSchema,
  updateIndicativeValuationSchema,
  indicationIdParamSchema,
  componentIdParamSchema,
  approveIndicativeValuationSchema,
  rejectIndicativeValuationSchema,
  reassignIndicativeValuationSchema,
} from "./indicativeValuation.dto";
import {
  getAllIndicativeValuations,
  createIndicativeValuation,
  getIndicativeValuation,
  exportIndicativeValuationsExcel,
  exportIndicativeValuationExcel,
  exportIndicativeValuationPdf,
  exportIndicativeValuationTxt,
  updateIndicativeValuation,
  submitForReview,
  approveValuation,
  rejectValuation,
  reassignIndicativeValuation,
  archiveIndicativeValuation,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
} from "./indicativeValuation.controller";

export const indicativeValuationRoutes = Router();

indicativeValuationRoutes.get(
  "/",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  getAllIndicativeValuations
);

indicativeValuationRoutes.post(
  "/",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  upload.fields([
    { name: "frontSide", maxCount: 1 },
    { name: "inside", maxCount: 1 },
  ]),
  parseJsonFields,
  validate(createIndicativeValuationSchema),
  createIndicativeValuation
);

indicativeValuationRoutes.get(
  "/export/excel",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  exportIndicativeValuationsExcel
);

indicativeValuationRoutes.get(
  "/:indicationId",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  validate(indicationIdParamSchema, "params"),
  getIndicativeValuation
);

indicativeValuationRoutes.get(
  "/:indicationId/export/excel",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  validate(indicationIdParamSchema, "params"),
  exportIndicativeValuationExcel
);

indicativeValuationRoutes.get(
  "/:indicationId/export/pdf",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  validate(indicationIdParamSchema, "params"),
  exportIndicativeValuationPdf
);

indicativeValuationRoutes.get(
  "/:indicationId/export/txt",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  validate(indicationIdParamSchema, "params"),
  exportIndicativeValuationTxt
);

indicativeValuationRoutes.patch(
  "/:indicationId",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  upload.fields([
    { name: "frontSide", maxCount: 1 },
    { name: "inside", maxCount: 1 },
  ]),
  parseJsonFields,
  validate(indicationIdParamSchema, "params"),
  validate(updateIndicativeValuationSchema),
  updateIndicativeValuation
);

indicativeValuationRoutes.post(
  "/:indicationId/submit",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  validate(indicationIdParamSchema, "params"),
  submitForReview
);

indicativeValuationRoutes.patch(
  "/:indicationId/approve",
  authenticate,
  authorizeAny(2, ["property:read", "dashboard:read"]),
  validate(indicationIdParamSchema, "params"),
  validate(approveIndicativeValuationSchema),
  approveValuation
);

indicativeValuationRoutes.patch(
  "/:indicationId/reject",
  authenticate,
  authorizeAny(2, ["property:read", "dashboard:read"]),
  validate(indicationIdParamSchema, "params"),
  validate(rejectIndicativeValuationSchema),
  rejectValuation
);

indicativeValuationRoutes.patch(
  "/:indicationId/reassign",
  authenticate,
  authorizeAny(2, ["property:read", "dashboard:read"]),
  validate(indicationIdParamSchema, "params"),
  validate(reassignIndicativeValuationSchema),
  reassignIndicativeValuation
);

indicativeValuationRoutes.delete(
  "/:indicationId",
  authenticate,
  authorizeAny(2, ["property:read", "dashboard:read"]),
  validate(indicationIdParamSchema, "params"),
  archiveIndicativeValuation
);

indicativeValuationRoutes.get(
  "/:indicationId/components/:id",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  validate(indicationIdParamSchema, "params"),
  validate(componentIdParamSchema, "params"),
  getComponentById
);

indicativeValuationRoutes.post(
  "/:indicationId/components",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  validate(indicationIdParamSchema, "params"),
  validate(createIndicativeComponentSchema),
  createComponent
);

indicativeValuationRoutes.patch(
  "/:indicationId/components/:id",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  validate(indicationIdParamSchema, "params"),
  validate(componentIdParamSchema, "params"),
  validate(updateIndicativeComponentSchema),
  updateComponent
);
indicativeValuationRoutes.delete(
  "/:indicationId/components/:id",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  validate(indicationIdParamSchema, "params"),
  validate(componentIdParamSchema, "params"),
  deleteComponent
);
