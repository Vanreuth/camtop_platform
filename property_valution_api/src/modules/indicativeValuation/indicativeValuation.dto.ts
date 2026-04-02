import { z } from "zod";
import {
  WorkflowStatus,
  PropertyIndicativeValuationStatus,
  PropertyStatus,
  SourceTypeEnum,
  TitleTypeEnum,
} from "@prisma/client";

// Replace with z.nativeEnum(IndicativeComponentType) from @prisma/client after prisma generate.
export const IndicativeComponentType = {
  LAND: "LAND",
  BUILDING: "BUILDING",
  OTHER: "OTHER",
} as const;

export type IndicativeComponentType =
  (typeof IndicativeComponentType)[keyof typeof IndicativeComponentType];

const positiveDecimal = z
  .union([z.string(), z.number()])
  .transform((value) => Number(value))
  .refine((value) => !Number.isNaN(value) && value >= 0, {
    message: "Must be a non-negative number",
  });

const geoJsonCoordinateSchema = z.tuple([z.number(), z.number()]);

const geoJsonPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(geoJsonCoordinateSchema)).min(1),
});

const propertyAddressSchema = z.object({
  provinceId: z.string().min(1),
  districtId: z.string().min(1),
  communeId: z.string().min(1),
  villageId: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  houseNo: z.string().nullable().optional(),
  titleAddress: z.string().nullable().optional(),
  accessRoads: z.string().nullable().optional(),
  neighborLocation: z.string().nullable().optional(),
});

const propertyLocationSchema = z
  .object({
    latitude: z.union([z.number(), z.string()]).transform(Number).optional(),
    longitude: z.union([z.number(), z.string()]).transform(Number).optional(),
    googlePoint: z.string().optional(),
    geolocationLink: z.string().optional(),
    formattedAddress: z.string().optional(),
    placeId: z.string().optional(),
    polygon: z.union([z.string(), geoJsonPolygonSchema, z.null()]).optional(),
  })
  .refine(
    (data) =>
      (data.latitude === undefined && data.longitude === undefined) ||
      (data.latitude !== undefined && data.longitude !== undefined),
    { message: "latitude and longitude must be provided together" }
  );

const dataSourceSchema = z.object({
  sourceType: z.nativeEnum(SourceTypeEnum),
  contactName: z.string().optional(),
  phoneNumber: z.string().min(1).optional(),
});

const propertyPhotosSchema = z.object({
  frontSide: z.string().url().nullable().optional(),
  inside: z.string().url().nullable().optional(),
  leftSide: z.string().url().nullable().optional(),
  rightSide: z.string().url().nullable().optional(),
  opposite: z.string().url().nullable().optional(),
  gallery: z.array(z.string().url()).nullable().optional(),
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

const createPropertyForIndicativeSchema = z.object({
  propertyTypeId: z.number().int().positive(),
  propertySubtypeId: z.number().int().positive().optional(),
  currentUseId: z.number().int().positive().optional(),
  propertyName: z.string().max(255).optional(),
  status: z.nativeEnum(PropertyStatus).optional(),
  workflowStatus: z.nativeEnum(WorkflowStatus).optional(),
  description: z.string().optional(),
  propertyAddress: propertyAddressSchema.optional(),
  propertyLocation: propertyLocationSchema.optional(),
  dataSource: dataSourceSchema.optional(),
  titleDocument: titleDocumentSchema.optional(),
  propertyPhotos: propertyPhotosSchema.optional(),
});

const updatePropertyForIndicativeSchema = z.object({
  propertyTypeId: z.number().int().positive().optional(),
  propertySubtypeId: z.number().int().positive().optional().nullable(),
  currentUseId: z.number().int().positive().optional().nullable(),
  propertyName: z.string().max(255).optional(),
  status: z.nativeEnum(PropertyStatus).optional(),
  workflowStatus: z.nativeEnum(WorkflowStatus).optional(),
  description: z.string().optional(),
  propertyAddress: propertyAddressSchema.partial().optional(),
  propertyLocation: propertyLocationSchema.optional(),
  dataSource: dataSourceSchema.partial().optional(),
  titleDocument: titleDocumentSchema.partial().optional(),
  propertyPhotos: propertyPhotosSchema.partial().optional(),
});

const sharedIndicativeFields = {
  indicationNo: z.string().min(1).max(50).optional(),
  valuationNo: z.string().min(1).max(50).optional(),
  currency: z.string().min(3).max(3).optional(),
  status: z.nativeEnum(PropertyIndicativeValuationStatus).optional(),
  workflowStatus: z.nativeEnum(WorkflowStatus).optional(),
  instructedBy: z.string().max(255).optional(),
  preparedFor: z.string().max(255).optional(),
  contactName: z.string().max(255).optional(),
  contactTel: z.string().max(50).optional(),
  chargeFee: positiveDecimal.nullable().optional(),
  valuerId: z.number().int().positive().optional(),
  inspectorName: z.string().max(100).optional(),
  instructionDate: z.coerce.date().optional(),
  dateOfInspection: z.coerce.date().optional(),
  indicationDate: z.coerce.date().optional(),
  valuationDate: z.coerce.date().optional(),
  dateOfReport: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  intendedUse: z.string().max(255).optional(),
  purposeOfValuation: z.string().optional(),
  forcedSalePercent: positiveDecimal.nullable().optional(),
  note: z.string().optional(),
  internalNotes: z.string().optional(),
};

const sharedComponentFields = {
  componentType: z.enum(["LAND", "BUILDING", "OTHER"]).default("LAND"),
  description: z.string().max(255).optional(),
  area: positiveDecimal.optional(),
  unit: z.string().max(20).default("sqm"),
  minRate: positiveDecimal,
  maxRate: positiveDecimal,
};

export const createIndicativeComponentSchema = z.object(sharedComponentFields);

export const createIndicativeValuationSchema = z
  .object({
    propertyId: z.number().int().positive().optional(),
    property: createPropertyForIndicativeSchema.optional(),
    ...sharedIndicativeFields,
    ...sharedComponentFields,
  })
  .superRefine((data, ctx) => {
    const hasPropertyId = typeof data.propertyId === "number";
    const hasProperty = !!data.property;

    if (!hasPropertyId && !hasProperty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either propertyId or property data",
        path: ["propertyId"],
      });
    }

    if (hasPropertyId && hasProperty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either propertyId or property data, not both",
        path: ["propertyId"],
      });
    }
  });

export const updateIndicativeComponentSchema = createIndicativeComponentSchema.partial();

export const updateIndicativeValuationSchema = z.object({
  propertyId: z.number().int().positive().optional(),
  property: updatePropertyForIndicativeSchema.optional(),
  ...sharedIndicativeFields,
  componentType: z.enum(["LAND", "BUILDING", "OTHER"]).optional(),
  description: z.string().max(255).optional(),
  area: positiveDecimal.optional(),
  unit: z.string().max(20).optional(),
  minRate: positiveDecimal.optional(),
  maxRate: positiveDecimal.optional(),
});

export const indicationIdParamSchema = z.object({
  indicationId: z.string().regex(/^\d+$/).transform(Number),
});

// Backward-compatible export for existing imports.
export const valuationIdParamSchema = indicationIdParamSchema;

export const componentIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const approveIndicativeValuationSchema = z.object({
  notes: z.string().optional(),
});

export const rejectIndicativeValuationSchema = z.object({
  rejectionReason: z.string().min(1, "Rejection reason is required"),
});

export const reassignIndicativeValuationSchema = z.object({
  newValuerId: z.number().int().positive(),
  reason: z.string().optional(),
});

export const indicativeValuationFiltersSchema = z.object({
  propertyId: z.coerce.number().int().positive().optional(),
  propertyTypeId: z.coerce.number().int().positive().optional(),
  instructedBy: z.string().min(1).optional(),
  preparedFor: z.string().min(1).optional(),
  intendedUse: z.string().min(1).optional(),
  purposeOfValuation: z.string().min(1).optional(),
  provinceId: z.string().min(1).optional(),
  districtId: z.string().min(1).optional(),
  communeId: z.string().min(1).optional(),
  villageId: z.string().min(1).optional(),
  minMarketValue: z.coerce.number().nonnegative().optional(),
  maxMarketValue: z.coerce.number().nonnegative().optional(),
  valuerId: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(PropertyIndicativeValuationStatus).optional(),
  workflowStatus: z.nativeEnum(WorkflowStatus).optional(),
  search: z.string().optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateIndicativeComponentDTO = z.infer<typeof createIndicativeComponentSchema>;
export type CreateIndicativeValuationDTO = z.infer<typeof createIndicativeValuationSchema>;
export type UpdateIndicativeComponentDTO = z.infer<typeof updateIndicativeComponentSchema>;
export type UpdateIndicativeValuationDTO = z.infer<typeof updateIndicativeValuationSchema>;
export type ApproveIndicativeValuationDTO = z.infer<typeof approveIndicativeValuationSchema>;
export type RejectIndicativeValuationDTO = z.infer<typeof rejectIndicativeValuationSchema>;
export type ReassignIndicativeValuationDTO = z.infer<typeof reassignIndicativeValuationSchema>;
export type IndicativeValuationFiltersDTO = z.infer<typeof indicativeValuationFiltersSchema>;
