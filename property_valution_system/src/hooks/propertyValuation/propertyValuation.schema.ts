import { z } from "zod";

const dateField = z.union([z.string(), z.date()]).optional();

const baseValuationSchema = z.object({
  propertyId: z.number().optional(),
  property: z.record(z.unknown()).optional(),
  valuationNo: z.string().optional(),
  landValue: z.number().optional().nullable(),
  buildingValue: z.number().optional().nullable(),
  marketValue: z.number().optional(),
  forcedSaleValue: z.number().optional(),
  pricePerSqm: z.number().optional(),
  dateOfInspection: dateField,
  valuationMethod: z.string().optional(),
  currency: z.string().optional(),
  valuationDate: dateField,
  dateOfReport: dateField,
  valuerId: z.number().optional(),
  inspectorName: z.string().optional(),
  status: z.string().optional(),
  purposeOfValuation: z.string().optional(),
  note: z.string().optional(),
  internalNotes: z.string().optional(),
  preparedFor: z.string().optional(),
});

export const propertyValuationBaseSchema = baseValuationSchema;

export const createPropertyValuationSchema = baseValuationSchema
  .refine((data) => data.propertyId || data.property, {
    message: "Property ID or property data is required",
    path: ["propertyId"],
  })
  .refine(
    (data) => {
      if (
        data.marketValue == null ||
        data.forcedSaleValue == null
      ) {
        return true;
      }

      return data.forcedSaleValue <= data.marketValue;
    },
    {
      message: "Forced sale value cannot exceed market value",
      path: ["forcedSaleValue"],
    }
  );


export const updatePropertyValuationSchema = baseValuationSchema;

export const approveValuationSchema = z.object({
  notes: z.string().optional(),
});

export const rejectValuationSchema = z.object({
  rejectionReason: z
    .string()
    .min(1, "Rejection reason is required"),
});
