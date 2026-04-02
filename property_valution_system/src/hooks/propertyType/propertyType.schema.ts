import { z } from "zod";

export const propertyTypeIdSchema = z.number().int().positive();
export type PropertyTypeIdInput = z.infer<typeof propertyTypeIdSchema>;
