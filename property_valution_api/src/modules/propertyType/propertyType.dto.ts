import { z } from "zod";

export const CreatePropertyTypeSchema = z.object({
  recordTypeId: z.coerce.number().int().positive(),
  propertyTypeName: z.string().trim().min(3).max(100),
  subtypeName: z.array(z.string().trim().min(1)).optional(),
  currentUseId: z.array(z.coerce.number().int().positive()).optional(),
});

export type CreatePropertyTypeDto = z.infer<typeof CreatePropertyTypeSchema>;

export const UpdatePropertyTypeSchema = CreatePropertyTypeSchema.partial();
export type UpdatePropertyTypeDto = z.infer<typeof UpdatePropertyTypeSchema>;

export const propertyTypeIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .min(1, "Property type ID must be a positive integer"),
});
