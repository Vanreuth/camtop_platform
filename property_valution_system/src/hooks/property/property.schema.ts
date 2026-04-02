import { z } from "zod";

/**
 * Property Workflow Validation Schemas
 */
export const approvePropertySchema = z.object({
  notes: z.string().optional(),
});

export const rejectPropertySchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

export const propertyIdSchema = z.number().int().positive();

export const propertyLocationPointSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export const propertyLocationPolygonSchema = z.array(propertyLocationPointSchema).min(3);

export type PropertyIdInput = z.infer<typeof propertyIdSchema>;
