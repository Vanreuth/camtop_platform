import { z } from "zod";
import {
  Physical_condition,
  PropertyStatus,
  WorkflowStatus,
  UnitType,
  SourceTypeEnum,
  TitleTypeEnum,
  ViewType,
  LandShapeEnum,
  TopographyEnum,
  SitePositionEnum,
  WaterSourceEnum,
  TypeOfTreeEnum,
  ConstructionStatus,
  TransactionType,
  ValuationMethod,
} from "@prisma/client";

export const SearchFiltersSchema = z.object({
  search: z.string().optional(),
  propertyName: z.string().optional(),
  propertyCode: z.string().optional(),
	propertyTypeId: z.coerce.number().int().positive().optional(),
	propertySubtypeId: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(PropertyStatus).optional(),
  workflowStatus: z.nativeEnum(WorkflowStatus).optional(),
  provinceId: z.string().optional(),
  districtId: z.string().optional(),
  communeId: z.string().optional(),
  villageId: z.string().optional(),
	minPrice: z.coerce.number().positive().optional(),
	maxPrice: z.coerce.number().positive().optional(),
	minLandArea: z.coerce.number().positive().optional(),
	maxLandArea: z.coerce.number().positive().optional(),
	createdAfter: z.coerce.date().optional(),
	createdBefore: z.coerce.date().optional(),
	createdById: z.coerce.number().int().positive().optional(),

	// If true, include properties that already have valuations
	// or indicative valuations.
	includeValuated: z.coerce.boolean().optional(),
});

export const PaginationOptionsSchema = z.object({
	page: z.coerce.number().int().positive().optional().default(1),
	limit: z.coerce.number().int().positive().optional().default(10),
	sortBy: z.string().optional().default("propertyId"),
	sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
});

const propertyAddressSchema = z.object({
  provinceId: z.string().min(1, "Province is required"),
  districtId: z.string().min(1, "District is required"),
  communeId: z.string().min(1, "Commune is required"),
  villageId: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  houseNo: z.string().nullable().optional(),
  titleAddress: z.string().nullable().optional(),
  accessRoads: z.string().nullable().optional(),
  neighborLocation: z.string().nullable().optional(),
});

// GeoJSON Polygon Schema for shape drawing
const geoJsonCoordinateSchema = z.tuple([z.number(), z.number()]); // [lng, lat]

const geoJsonPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(geoJsonCoordinateSchema)).min(1),
});

const propertyLocationSchema = z
  .object({
	latitude: z
	  .union([z.number(), z.string()])
	  .transform((val) => Number(val))
	  .optional(),
	longitude: z
	  .union([z.number(), z.string()])
	  .transform((val) => Number(val))
	  .optional(),
	googlePoint: z.string().optional(),
	geolocationLink: z.string().optional(),
	formattedAddress: z.string().optional(),
	placeId: z.string().optional(),
	polygon: z.union([
	  z.string(),
	  geoJsonPolygonSchema,
	  z.null()
	]).optional(),
	userLengthM: z.number().optional().nullable(),
    userHeightM: z.number().optional().nullable(),
  })
  .optional()
  .nullable();

const propertyPhotosSchema = z.object({
  frontSide: z.string().optional(),
  inside: z.string().optional(),
  leftSide: z.string().optional(),
  rightSide: z.string().optional(),
  opposite: z.string().optional(),
  gallery: z.array(z.string()).optional(),
});

const landSchema = z
  .object({
	widthMeters: z.number().optional(),
	lengthMeters: z.number().optional(),
	landAreaSqm: z.number().optional(),
	landShape: z.nativeEnum(LandShapeEnum).optional(),
	topography: z.nativeEnum(TopographyEnum).optional(),
	sitePosition: z.nativeEnum(SitePositionEnum).optional(),
	waterSource: z.nativeEnum(WaterSourceEnum).optional(),
  })
  .refine(
	(data) => {
	  if (!data.landAreaSqm && data.widthMeters && data.lengthMeters) {
		data.landAreaSqm = data.widthMeters * data.lengthMeters;
	  }
	  return true;
	},
	{
	  message: "landAreaSqm will be auto-calculated from width × length",
	}
  );

const agricultureLandSchema = z.object({
  typeofTree: z.nativeEnum(TypeOfTreeEnum).optional(),
  numberOfTrees: z.number().optional(),
  ageOfTrees: z.number().optional(),
});

const titleDocumentSchema = z.object({
  titleDeedType: z.nativeEnum(TitleTypeEnum),
  titleDeedNo: z.string().nullable().optional(),
  issuedYear: z.string().nullable().optional(),
  parcelNo: z.string().nullable().optional(),
  totalSizeByTitleDeed: z.number().nullable().optional(),
  coverPhotoUrl: z.string().optional(),
  backSidePhotoUrl: z.string().optional(),
});

const dataSourceSchema = z.object({
  sourceType: z.nativeEnum(SourceTypeEnum).optional(),
  contactName: z.string().optional(),
  phoneNumber: z.string().min(1, "Phone number is required"),
});

// Building Unit Schema - made more flexible
const buildingUnitSchema = z.object({
  buildingUnitId: z.number().int().positive().optional(),
  buildingId: z.number().int().positive().optional().nullable(),
  unitNo: z.string().min(1, "Unit number is required"),
  propertyTypeId: z.number().int().positive().optional(),
  unitType: z.nativeEnum(UnitType).optional(),
  floorNo: z.number().int().min(1, "Floor number must be at least 1"),
  floorAreaSqm: z.number().positive().min(1, "Floor area must be positive"),
  totalAreaSqm: z.number().positive().optional(),
  numberOfBedrooms: z.number().int().min(0).optional(),
  numberOfBathrooms: z.number().int().min(0).optional(),
  hasKitchen: z.boolean().optional().default(true),
  hasLivingRoom: z.boolean().optional().default(true),
  hasParkingSpace: z.boolean().optional().default(false),
  physical_condition: z.nativeEnum(Physical_condition).optional(),
  managementFeeValue: z.number().positive().optional(),
  viewType: z.nativeEnum(ViewType).optional(),
  constructedYear: z.number().int().min(1900).max(2100).optional(),
  effectiveAge: z.number().int().min(0).optional(),
  usefulLife: z.number().int().positive().optional().default(50),
  costPerSqm: z.number().positive().optional(),
  replacementCostPerSqm: z.number().positive().optional(),
  totalBuildingCost: z.number().positive().optional(),

});

// Building Schema - with proper validations
const buildingSchema = z
  .object({
    buildingId: z.number().int().positive().optional(),
		// Optional fields - will be validated conditionally based on property type
		buildingSubtypeId: z
	  .number()
	  .int()
	  .positive("Building type is required")
	  .optional()
	  .nullable(),
	buildingName: z.string().min(1, "Building name is required").optional(),

	// Dimensions
	width: z.number().positive().optional(),
	length: z.number().positive().optional(),
	numberOfStorey: z.number().int().positive().optional(),
	grossAreaSqm: z.number().positive().optional(),

	// Room counts
	bedroom: z.number().int().min(0).optional(),
	bathroom: z.number().int().min(0).optional(),
	livingroom: z.number().int().min(0).optional(),
	kitchen: z.number().int().min(0).optional(),
	diningroom: z.number().int().min(0).optional(),
	totalRoom: z.number().int().min(0).optional(),
	parkingSpace: z.number().int().min(0).optional(),

	// Construction details
	constructionYear: z.number().int().min(1900).max(2100).optional(),
	percentageOfConstruction: z.number().min(0).max(100).optional(),
	effectiveAge: z.number().int().min(0).optional(),
	usefulLife: z.number().int().positive().optional().default(50),

	// Financial
	costPerSqm: z.number().positive().optional(),
	replacementCostPerSqm: z.number().positive().optional(),
	totalBuildingCost: z.number().positive().optional(),

	// Additional details
	buildingImage: z.string().optional(),
	viewType: z.nativeEnum(ViewType).optional(),
	status: z.nativeEnum(ConstructionStatus).optional().default("COMPLETED"),

	// Units array
	units: z.array(buildingUnitSchema).optional().default([]),
  })
  .refine(
	(data) => {
	  // If units exist, validate totalUnits matches
	  if (data.units && data.units.length > 0) {
		return true;
	  }
	  return true;
	},
	{
	  message: "Building units validation",
	}
  );

// Transaction Schema for create property with transaction
const transactionSchema = z.object({
  transactionId: z.number().int().positive().optional(),
  transactionType: z.nativeEnum(TransactionType, {
    required_error: "Transaction type is required",
  }),
  transactionDate: z
    .union([z.string().trim().min(1, "Transaction date is required"), z.date()])
    .pipe(z.coerce.date()),
  totalPrice: z.coerce
    .number({
      required_error: "Total price is required",
      invalid_type_error: "Total price is required",
    })
    .positive("Total price must be positive"),
  valuationId: z.number().int().positive().optional(),
});

// Main Create Property Schema
const CreatePropertyBaseSchema = z.object({
		propertyName: z.string().optional(),
		propertyCode: z.string().optional(),
		propertyTypeId: z.number().int().positive("Property type is required"),
	propertySubtypeId: z.number().int().positive().optional(),
	currentUseId: z.number().int().positive().optional(),
	status: z.nativeEnum(PropertyStatus).optional().default(PropertyStatus.ACTIVE),
	workflowStatus: z.nativeEnum(WorkflowStatus).optional().default(WorkflowStatus.DRAFT),
	description: z.string().optional(),
	createdBy: z.number().int().positive().optional(),

	// Related data
	propertyAddress: propertyAddressSchema.optional(),
	propertyLocation: z.any().optional(),
	titleDocument: titleDocumentSchema.optional(),
	dataSource: dataSourceSchema.optional(),
	land: landSchema.optional(),
	agricultureLand: agricultureLandSchema.optional(),

	// Buildings array (for LandAndBuilding types: 5, 6, 7, 8, 9)
	building: z.array(buildingSchema).optional().default([]),

	// Building Units array (for direct units - Residential/Commercial Buildings: 3, 4)
	buildingUnit: z.array(buildingUnitSchema).optional().default([]),

		propertyPhotos: propertyPhotosSchema.optional(),
		transaction: transactionSchema,
		// valuation: propertyValuationSchema.optional(),
	  });

export const CreatePropertySchema = CreatePropertyBaseSchema
  .refine(
		(data) => {
		  // Property types that require buildings WITH parent building records
	  const buildingWithParentTypes = [5, 6, 7, 8, 9]; // LandAndBuilding types

	  // Property types that require DIRECT building units (no parent building)
	  const directUnitTypes = [3, 4]; // Residential Building, Commercial Building

	  // Validate buildings for LandAndBuilding types
	  if (buildingWithParentTypes.includes(data.propertyTypeId)) {
		if (!data.building || data.building.length === 0) {
		  return false;
		}
	  }

	  // Validate direct units for Residential/Commercial Buildings
	  if (directUnitTypes.includes(data.propertyTypeId)) {
		// For these types, units should be in buildingUnit array OR in building[0].units
		const hasDirectUnits =
		  data.buildingUnit && data.buildingUnit.length > 0;
		const hasUnitsInBuilding =
		  data.building &&
		  data.building.length > 0 &&
		  data.building[0].units &&
		  data.building[0].units.length > 0;

		if (!hasDirectUnits && !hasUnitsInBuilding) {
		  return false;
		}
	  }

	  return true;
	},
	{
	  message: "Property type requires appropriate building or unit data",
	  path: ["building"],
	}
  )
  .refine(
	(data) => {
	  // Validation: If property type requires land, ensure land data exists
	  const landRequiredTypes = [1, 2, 5, 6, 7, 8, 9]; // Land and LandAndBuilding types

	  if (landRequiredTypes.includes(data.propertyTypeId)) {
		if (!data.land) {
		  return false;
		}
	  }
	  return true;
	},
	{
	  message: "This property type requires land information",
	  path: ["land"],
	}
  )
  .refine(
	(data) => {
	  const directUnitTypes = [3, 4];

	  if (directUnitTypes.includes(data.propertyTypeId)) {
		// If using buildingUnit array, buildings should be empty or contain only unit data
		if (data.buildingUnit && data.buildingUnit.length > 0) {
		  // Buildings array should be empty when using direct units
		  if (data.building && data.building.length > 0) {
			// Check if building has unnecessary fields
			const hasUnnecessaryBuildingData = data.building.some(
			  (b) => b.width || b.length || b.numberOfStorey || b.buildingName
			);
			if (hasUnnecessaryBuildingData) {
			  return false;
			}
		  }
		}
	  }
	  return true;
	},
	{
	  message:
		"Residential/Commercial Buildings should use direct units without building details",
	  path: ["buildingUnit"],
	}
	  );

const updateBuildingSchema = z.object({
  buildingId: z.number().int().positive().optional(),
  buildingSubtypeId: z.number().int().positive().optional().nullable(),
  buildingName: z.string().min(1).optional(),
  width: z.number().positive().optional(),
  length: z.number().positive().optional(),
  numberOfStorey: z.number().int().positive().optional(),
  grossAreaSqm: z.number().positive().optional(),
  bedroom: z.number().int().min(0).optional(),
  bathroom: z.number().int().min(0).optional(),
  livingroom: z.number().int().min(0).optional(),
  kitchen: z.number().int().min(0).optional(),
  diningroom: z.number().int().min(0).optional(),
  totalRoom: z.number().int().min(0).optional(),
  parkingSpace: z.number().int().min(0).optional(),
  constructionYear: z.number().int().min(1900).max(2100).optional(),
  percentageOfConstruction: z.number().min(0).max(100).optional(),
  effectiveAge: z.number().int().min(0).optional(),
  usefulLife: z.number().int().positive().optional(),
  costPerSqm: z.number().positive().optional(),
  replacementCostPerSqm: z.number().positive().optional(),
  totalBuildingCost: z.number().positive().optional(),
  buildingImage: z.string().optional(),
  viewType: z.nativeEnum(ViewType).optional(),
  status: z.nativeEnum(ConstructionStatus).optional(),
  units: z.array(buildingUnitSchema).optional(),
});

// File upload interface
export interface FileField {
  frontSide?: Express.Multer.File[];
  inside?: Express.Multer.File[];
  leftSide?: Express.Multer.File[];
  rightSide?: Express.Multer.File[];
  opposite?: Express.Multer.File[];
  gallery?: Express.Multer.File[];
  coverPhoto?: Express.Multer.File[];
  backSidePhoto?: Express.Multer.File[];
  buildingImage?: Express.Multer.File[];
  // Support multiple building images
  buildingImages?: Express.Multer.File[];
}

// Export types
export type CreatePropertyDto = z.infer<typeof CreatePropertySchema>;
export const UpdatePropertySchema = CreatePropertyBaseSchema.partial()
  .omit({
    // valuation: true,
  })
  .extend({
    // Do not apply create-time defaults during update.
    building: z.array(updateBuildingSchema).optional(),
    buildingUnit: z.array(buildingUnitSchema).optional(),
  });
export interface UpdatePropertyDto extends Partial<CreatePropertyDto> {
  deletedImages?: string[];
}
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;
export type PaginationOptions = z.infer<typeof PaginationOptionsSchema>;
export type BuildingDto = z.infer<typeof buildingSchema>;
export type BuildingUnitDto = z.infer<typeof buildingUnitSchema>;


export const propertyIdParamSchema = z.object({
	id: z.coerce.number().int().min(1, "Property ID must be a positive integer"),
});

export const transactionIdParamSchema = z.object({
	id: z.coerce.number().int().min(1, "Transaction ID must be a positive integer"),
});
