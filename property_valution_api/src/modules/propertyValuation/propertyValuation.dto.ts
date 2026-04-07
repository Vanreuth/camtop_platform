import { z } from "zod";
import {
  PropertyStatus,
  SourceTypeEnum,
  TitleTypeEnum,
  ValuationMethod,
  PropertyValuationStatus,
  WorkflowStatus,
} from "@prisma/client";

const valuationDateSchema = z.coerce.date();

const geoJsonCoordinateSchema = z.tuple([z.number(), z.number()]);
const geoJsonPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(geoJsonCoordinateSchema)).min(1),
});

const propertyAddressSchema = z.object({
  provinceId: z.string().min(1),
  districtId: z.string().min(1),
  communeId: z.string().min(1),
  villageId: z.string().nullable(),
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
    {
      message: "latitude and longitude must be provided together",
    }
  );

const dataSourceSchema = z.object({
  sourceType: z.nativeEnum(SourceTypeEnum),
  contactName: z.string().optional(),
  phoneNumber: z.string().min(1).optional(),
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

const createPropertyForValuationSchema = z.object({
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
});

const basePropertyValuationSchema = z.object({
  propertyId: z.number().int().positive().optional(),
  property: createPropertyForValuationSchema.optional(),
  valuationNo: z.string().trim().min(1).max(50),
  landValue: z.number().nonnegative().optional(),
  buildingValue: z.number().nonnegative().optional(),
  marketValue: z.number().nonnegative(),
  forcedSaleValue: z.number().nonnegative().optional(),
  pricePerSqm: z.number().nonnegative(),
  dateOfInspection: valuationDateSchema,
  valuationDate: valuationDateSchema,
  valuationMethod: z.nativeEnum(ValuationMethod),
  dateOfReport: valuationDateSchema,
  preparedFor: z.string().trim().min(1).max(255),
  currency: z.string().min(3).max(3).optional(),
  valuerId: z.number().int().positive().optional(),
  inspectorName: z.string().max(100).optional(),
  status: z.nativeEnum(PropertyValuationStatus),
  workflowStatus: z.nativeEnum(WorkflowStatus),
  purposeOfValuation: z.string().trim().min(1).max(500),
  note: z.string().max(500).optional(),
  internalNotes: z.string().max(500).optional(),
});

export const createPropertyValuationSchema = basePropertyValuationSchema
  .refine(
    (v) =>
      v.marketValue === undefined ||
      v.forcedSaleValue === undefined ||
      v.forcedSaleValue <= v.marketValue,
    {
      path: ["forcedSaleValue"],
      message: "Forced sale value cannot exceed market value",
    }
  )
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

export type CreatePropertyValuationDTO = z.infer<
  typeof createPropertyValuationSchema
>;

export const updatePropertySchema = z.object({
  propertyName: z.string().max(255).nullable().optional(),
  propertyTypeId: z.number().int().positive().optional(),
  propertySubtypeId: z.number().int().positive().nullable().optional(),
  currentUseId: z.number().int().positive().nullable().optional(),
  status: z.nativeEnum(PropertyStatus).optional(),
  description: z.string().nullable().optional(),
  propertyAddress: z.object({
    provinceId: z.string().optional(),
    districtId: z.string().optional(),
    communeId: z.string().optional(),
    villageId: z.string().nullable().optional(),
    street: z.string().nullable().optional(),
    houseNo: z.string().nullable().optional(),
    titleAddress: z.string().nullable().optional(),
    accessRoads: z.string().nullable().optional(),
    neighborLocation: z.string().nullable().optional(),
  }).nullable().optional(),

  propertyLocation: z.object({
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    formattedAddress: z.string().nullable().optional(),
    polygon: z.union([z.string(), geoJsonPolygonSchema, z.null()]).nullable().optional(),
  }).nullable().optional(),

  titleDocument: z.object({
    titleDeedType: z.string().optional(),
    titleDeedNo: z.string().nullable().optional(),
    issuedYear: z.string().nullable().optional(),
    parcelNo: z.string().nullable().optional(),
    totalSizeByTitleDeed: z.number().nullable().optional(),
    coverPhotoUrl: z.string().nullable().optional(),
    backSidePhotoUrl: z.string().nullable().optional(),
  }).nullable().optional(),

  dataSource: z.object({
    sourceType: z.string().optional(),
    contactName: z.string().nullable().optional(),
    phoneNumber: z.string().nullable().optional(),
  }).nullable().optional(),
}).strict();

export const updatePropertyValuationSchema = z.object({
  propertyId: z.number().int().positive().optional(),
  property: updatePropertySchema.optional(),

  valuationNo: z.string().min(1).max(50).optional(),
  landValue: z.number().nonnegative().optional(),
  buildingValue: z.number().nonnegative().optional(),
  marketValue: z.number().nonnegative().optional(),
  forcedSaleValue: z.number().nonnegative().optional(),
  pricePerSqm: z.number().nonnegative().optional(),
  dateOfInspection: z.coerce.date().optional(),
  valuationDate: z.coerce.date().optional(),
  dateOfReport: z.coerce.date().optional(),

  valuationMethod: z.string().optional(),
  currency: z.string().min(3).max(3).optional(),

  preparedFor: z.string().nullable().optional(),
  valuerId: z.number().int().positive().nullable().optional(),
  inspectorName: z.string().nullable().optional(),
  status: z.nativeEnum(PropertyValuationStatus).optional(),
  workflowStatus: z.nativeEnum(WorkflowStatus).optional(),

  purposeOfValuation: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
})
.refine(
  (v) =>
    v.marketValue === undefined ||
    v.forcedSaleValue === undefined ||
    v.forcedSaleValue <= v.marketValue,
  { path: ["forcedSaleValue"], message: "Forced sale value cannot exceed market value" }
);

export type UpdatePropertyValuationDTO = z.infer<typeof updatePropertyValuationSchema>;

export const reassignValuationSchema = z.object({
  newValuerId: z.number().int().positive(),
  reason: z.string().optional(),
});
export type ReassignValuationDTO = z.infer<typeof reassignValuationSchema>;


export interface valuationFiltersDTO {
  propertyId?: number;
  valuationMethod?: ValuationMethod;
  status?: PropertyValuationStatus;
  workflowStatus?: WorkflowStatus;
  valuerId?: number;
  approvedById?: number;
  valuationDateFrom?: Date;
  valuationDateTo?: Date;
  minValue?: number;
  maxValue?: number;
  search?: string;
  propertyName?: string;
  propertyTypeId?: number;
  preparedFor?: string;
  purposeOfValuation?: string;
  provinceId?: string;
  districtId?: string;
  communeId?: string;
  villageId?: string;
}
export interface valuationPaginationOptionsDTO {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
export interface ApproveValuationDTO {
  approvedById: number;
  notes?: string;
}
export interface RejectValuationDTO {
  rejectedById: number;
  rejectionReason: string;
}


export const propertyValuationIdParamSchema = z.object({
  id: z.coerce.number().int().min(1, "Valuation ID must be a positive integer"),
});
