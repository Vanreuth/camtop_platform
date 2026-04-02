import { z } from "zod";

export const provinceCodeParamSchema = z.object({
	provinceCode: z.string().min(1),
});

export const districtCodeParamSchema = z.object({
	districtCode: z.string().min(1),
});

export const communeCodeParamSchema = z.object({
	communeCode: z.string().min(1),
});

export const resolvePropertyAddressBodySchema = z
	.object({
		latitude: z.coerce.number().min(-90).max(90).optional(),
		longitude: z.coerce.number().min(-180).max(180).optional(),
		formattedAddress: z.string().trim().min(3).optional(),
	})
	.superRefine((value, ctx) => {
		const hasLatitude = value.latitude !== undefined;
		const hasLongitude = value.longitude !== undefined;
		const hasCoordinates = hasLatitude || hasLongitude;
		const hasFormattedAddress = Boolean(value.formattedAddress);

		if (hasCoordinates && (!hasLatitude || !hasLongitude)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: hasLatitude ? ["longitude"] : ["latitude"],
				message: "latitude and longitude must be provided together",
			});
		}

		if (!hasFormattedAddress && !hasCoordinates) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["formattedAddress"],
				message: "formattedAddress or latitude/longitude is required",
			});
		}
	});

