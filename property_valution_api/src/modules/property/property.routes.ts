import { Router } from "express";
import { authenticate, authorize, authorizeAny } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";
import parseJsonFields from "../../middleware/jsonParse.middleware";
import { validate } from "../../middleware/validation.middleware";
import { PropertyController } from "./property.controller";
import { CreatePropertySchema, UpdatePropertySchema, propertyIdParamSchema, transactionIdParamSchema } from "./property.dto";

export const propertyRoutes = Router();

propertyRoutes.get("/", authenticate, authorize(4, ["property:read"]), PropertyController.getAllProperties);

propertyRoutes.get(
	"/map/locations",
	authenticate,
	authorizeAny(3, ["property:read"]),
	PropertyController.getAllPropertyLocations
);

propertyRoutes.get(
	"/nearby-properties",
	authenticate,
	authorizeAny(3, ["property:read"]),
	PropertyController.getPropertiesNearby
);

propertyRoutes.get(
	"/statistics",
	authenticate,
	authorizeAny(3, ["property:read", "dashboard:read"]),
	PropertyController.getPropertyStatistics
);

propertyRoutes.post(
	"/search/polygon",
	authenticate,
	authorizeAny(3, ["property:read"]),
	PropertyController.searchPropertiesInPolygon
);

propertyRoutes.post(
	"/search/circle",
	authenticate,
	authorize(4, ["property:read"]),
	PropertyController.searchPropertiesInCircle
);

propertyRoutes.get(
	"/export/excel",
	authenticate,
	authorizeAny(3, ["property:read"]),
	PropertyController.exportPropertiesExcel
);

propertyRoutes.post(
	"/import/excel",
	authenticate,
	authorizeAny(3, ["property:create", "property:update", "property:manage"]),
	upload.single("excelFile"),
	PropertyController.importPropertiesExcel
);

// Reverse geocode coordinates to address
propertyRoutes.post(
	"/reverse-geocode",
	authenticate,
	authorize(4, ["property:read"]),
	PropertyController.reverseGeocode
);

propertyRoutes.get(
	"/:id",
	authenticate,
	authorize(4, ["property:read"]),
	validate(propertyIdParamSchema, "params"),
	PropertyController.getPropertyById
);

propertyRoutes.get(
	"/:id/nearby",
	authenticate,
	authorize(4, ["property:read"]),
	validate(propertyIdParamSchema, "params"),
	PropertyController.getPropertyLocationAnalysis
);


propertyRoutes.post(
	"/",
	authenticate,
	authorizeAny(4, ["property:create"]),
	upload.fields([
		{ name: "frontSide", maxCount: 1 },
		{ name: "inside", maxCount: 1 },
		{ name: "leftSide", maxCount: 1 },
		{ name: "rightSide", maxCount: 1 },
		{ name: "opposite", maxCount: 1 },
		{ name: "gallery", maxCount: 10 },
		{ name: "coverPhoto", maxCount: 1 },
		{ name: "backSidePhoto", maxCount: 1 },
		{ name: "buildingImage", maxCount: 1 },
		{ name: "buildingImages", maxCount: 20 },
	]),
	parseJsonFields,
	validate(CreatePropertySchema),
	PropertyController.createProperty
);

propertyRoutes.put(
	"/:id",
	authenticate,
	authorizeAny(4, ["property:update"]),
	upload.fields([
		{ name: "frontSide", maxCount: 1 },
		{ name: "inside", maxCount: 1 },
		{ name: "leftSide", maxCount: 1 },
		{ name: "rightSide", maxCount: 1 },
		{ name: "opposite", maxCount: 1 },
		{ name: "gallery", maxCount: 10 },
		{ name: "coverPhoto", maxCount: 1 },
		{ name: "backSidePhoto", maxCount: 1 },
		{ name: "buildingImage", maxCount: 1 },
		{ name: "buildingImages", maxCount: 20 },
	]),
	parseJsonFields,
	validate(UpdatePropertySchema),
	PropertyController.updateProperty
);

propertyRoutes.delete(
	"/:id",
	authenticate,
	authorize(2, ["property:manage","property:delete"]),
	validate(propertyIdParamSchema, "params"),
	PropertyController.deleteProperty
);

propertyRoutes.delete(
	"/transactions/:id",
	authenticate,
	authorizeAny(2, ["property:manage","property:delete"]),
	validate(transactionIdParamSchema, "params"),
	PropertyController.deleteTransaction
);

propertyRoutes.put(
	"/:id/location",
	authenticate,
	authorize(2, ["property:manage"]),
	validate(propertyIdParamSchema, "params"),
	PropertyController.updatePropertyLocation
);

/**
 * =====================================================
 * PROPERTY APPROVAL WORKFLOW ROUTES
 * =====================================================
 */
// Submit property for review
propertyRoutes.post(
	"/:id/submit",
	authenticate,
	authorize(4, ["property:read"]),
	validate(propertyIdParamSchema, "params"),
	PropertyController.submitPropertyForReview
);

// Approve property (Admin/Manager only)
propertyRoutes.post(
	"/:id/approve",
	authenticate,
	authorize(2, ["property:manage"]),
	validate(propertyIdParamSchema, "params"),
	PropertyController.approveProperty
);

// Reject property (Admin/Manager only)
propertyRoutes.post(
	"/:id/reject",
	authenticate,
	authorize(2, ["property:manage"]),
	validate(propertyIdParamSchema, "params"),
	PropertyController.rejectProperty
);

// Archive property
propertyRoutes.post(
	"/:id/archive",
	authenticate,
	authorize(2, ["property:manage"]),
	validate(propertyIdParamSchema, "params"),
	PropertyController.archiveProperty
);

// Restore archived property
propertyRoutes.post(
	"/:id/restore",
	authenticate,
	authorize(2, ["property:manage"]),
	validate(propertyIdParamSchema, "params"),
	PropertyController.restoreProperty
);

// Reassign property to a different user (Admin/Manager only)
propertyRoutes.post(
	"/:id/reassign",
	authenticate,
	authorize(2, ["property:manage"]),
	validate(propertyIdParamSchema, "params"),
	PropertyController.reassignProperty
);
