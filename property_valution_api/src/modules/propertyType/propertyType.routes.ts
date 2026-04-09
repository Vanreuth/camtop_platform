import { Router } from "express";
import {
  getAllPropertyTypes,
  getPropertyTypeById,
  createPropertyType,
  updatePropertyType,
  deletePropertyType,
} from "./propertyType.controller";
import {
  CreatePropertyTypeSchema,
  propertyTypeIdParamSchema,
} from "./propertyType.dto";
import {
  authenticate,
  authorize,
  superAdminOnly,
} from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";

export const propertyTypeRoutes = Router();

propertyTypeRoutes.get(
  "/",
  authenticate,
  authorize(4, ["property:read"]),
  getAllPropertyTypes
);

propertyTypeRoutes.get(
  "/:id",
  authenticate,
  authorize(4, ["property:read"]),
  validate(propertyTypeIdParamSchema, "params"),
  getPropertyTypeById
);

propertyTypeRoutes.post(
  "/",
  authenticate,
  superAdminOnly(),
  validate(CreatePropertyTypeSchema),
  createPropertyType
);

propertyTypeRoutes.put(
  "/:id",
  authenticate,
  authorize(2, ["property:read"]),
  validate(propertyTypeIdParamSchema, "params"),
  updatePropertyType
);

propertyTypeRoutes.delete(
  "/:id",
  authenticate,
  authorize(2, ["property:read"]),
  validate(propertyTypeIdParamSchema, "params"),
  deletePropertyType
);
