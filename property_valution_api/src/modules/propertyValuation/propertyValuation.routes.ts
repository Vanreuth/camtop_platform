import { Router } from "express";
import {
  createPropertyValuation,
  getAllPropertyValuation,
  getPropertyValuationById,
  updatePropertyValuation,
  submitForReview,
  approveValuation,
  rejectValuation,
  deletePropertyValuation,
  getValuationStatistics,
  getValuationDocumentDownload,
  reassignValuation,
  exportPropertyValuationExcel,
  importPropertyValuationExcel,
} from "./propertyValuation.controller";
import { authenticate, authorize,authorizeAny } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import { upload, validatePdfMagicNumber } from "../../middleware/upload.middleware";
import parseJsonFields from "../../middleware/jsonParse.middleware";
import {
  createPropertyValuationSchema,
  updatePropertySchema,
  propertyValuationIdParamSchema,
  updatePropertyValuationSchema,
} from "./propertyValuation.dto";
export const propertyValuationRoutes = Router();

propertyValuationRoutes.post(
  "/",
  authenticate,
  authorizeAny(3, ["property:read", "dashboard:read"]),
  upload.fields([{ name: "valuationPdf", maxCount: 1 }]),
  validatePdfMagicNumber,
  parseJsonFields,
  validate(createPropertyValuationSchema),
  createPropertyValuation
);

propertyValuationRoutes.get(
  "/",
  authenticate,
  authorize(3, ["property:read"]),
  getAllPropertyValuation
);

propertyValuationRoutes.get(
  "/statistics",
  authenticate,
  authorizeAny(3, ["dashboard:read"]),
  getValuationStatistics
);

propertyValuationRoutes.get(
  "/export/excel",
  authenticate,
  authorize(3, ["property:read"]),
  exportPropertyValuationExcel
);

propertyValuationRoutes.post(
  "/import/excel",
  authenticate,
  authorizeAny(3, ["property:create", "property:update", "property:manage"]),
  upload.single("excelFile"),
  importPropertyValuationExcel
);

propertyValuationRoutes.get(
  "/:id/document",
  authenticate,
  authorize(3, ["property:read"]),
  validate(propertyValuationIdParamSchema, "params"),
  getValuationDocumentDownload
);

propertyValuationRoutes.get(
  "/:id",
  authenticate,
  authorize(3, ["property:read"]),
  validate(propertyValuationIdParamSchema, "params"),
  getPropertyValuationById
);

propertyValuationRoutes.put(
  "/:id",
  authenticate,
  authorize(3, ["property:update"]),
  validate(propertyValuationIdParamSchema, "params"),
  validate(updatePropertyValuationSchema),
  updatePropertyValuation
);

propertyValuationRoutes.delete(
  "/:id",
  authenticate,
  authorize(3, ["property:create"]),
  validate(propertyValuationIdParamSchema, "params"),
  deletePropertyValuation
);

propertyValuationRoutes.post(
  "/:id/submit",
  authenticate,
  authorize(3, ["property:create"]),
  validate(propertyValuationIdParamSchema, "params"),
  submitForReview
);

propertyValuationRoutes.post(
  "/:id/approve",
  authenticate,
  authorize(2, ["property:manage"]),
  validate(propertyValuationIdParamSchema, "params"),
  approveValuation
);

propertyValuationRoutes.post(
  "/:id/reject",
  authenticate,
  authorize(3, ["property:manage"]),
  validate(propertyValuationIdParamSchema, "params"),
  rejectValuation
);

propertyValuationRoutes.patch(
  "/:id/reassign",
  authenticate,
  authorize(2, ["property:manage"]),
  validate(propertyValuationIdParamSchema, "params"),
  reassignValuation
);
