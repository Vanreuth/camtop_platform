import { ReportTypeEnum } from "@prisma/client";
import { z } from "zod";

export const supportedReportTargetSchema = z.enum([
  "USER",
  "PROPERTY",
  "PROPERTY_VALUATION",
  "INDICATIVE_VALUATION",
]);

export const supportedReportFormatSchema = z.enum(["XLSX", "PDF"]);

export const supportedStoredReportTypeSchema = z.nativeEnum(ReportTypeEnum);

export const createReportSchema = z.object({
  reportTarget: supportedReportTargetSchema,
  format: supportedReportFormatSchema.default("XLSX"),
  reportName: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export const reportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  search: z.string().trim().optional(),
  reportType: supportedStoredReportTypeSchema.optional(),
  reportTarget: supportedReportTargetSchema.optional(),
  format: supportedReportFormatSchema.optional(),
  generatedByMe: z
    .union([z.coerce.boolean(), z.enum(["true", "false"])])
    .optional(),
});

export const reportIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateReportDto = z.infer<typeof createReportSchema>;
export type ReportListQueryDto = z.infer<typeof reportListQuerySchema>;
export type ReportTarget = z.infer<typeof supportedReportTargetSchema>;
export type ReportFormat = z.infer<typeof supportedReportFormatSchema>;
