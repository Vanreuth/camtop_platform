import type { Request, Response } from "express";
import type { AuthRequest } from "../../common/types/auth.type";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { ForbiddenError } from "../../common/errors/forbidden.error";
import { successResponse } from "../../common/utils/responseHelper";
import {
	PropertyStatus,
	PropertyValuationStatus,
	ValuationMethod,
	WorkflowStatus,
} from "@prisma/client";
import type { FileField } from "./property.dto";
import { PaginationOptionsSchema, SearchFiltersSchema } from "./property.dto";
import { propertyService } from "./property.service";
import expressAsyncHandler from "express-async-handler";
import { googleMapService } from "../../services/googleMap.service";
import {
	exportPropertiesToExcel,
	importPropertiesFromExcel,
} from "./property.excel.service";

export class PropertyController {
	static async getAllProperties(req: Request, res: Response) {
		const filters = SearchFiltersSchema.parse(req.query);
		const pagination = PaginationOptionsSchema.parse(req.query);

		const data = await propertyService.getAllProperties(filters, pagination);

		return successResponse(
			res,
			200,
			{ properties: data.items },
			"Get Properties successfully",
			{ pagination: data.pagination }
		);
	}

	static async exportPropertiesExcel(req: Request, res: Response) {
		const parsePositiveInt = (value: unknown, field: string) => {
			if (typeof value !== "string") return undefined;
			const parsed = Number(value);
			if (!Number.isInteger(parsed) || parsed <= 0) {
				throw new BadRequestError(`${field} must be a positive integer`);
			}
			return parsed;
		};
		const parseNonNegativeNumber = (value: unknown, field: string) => {
			if (typeof value !== "string") return undefined;
			const parsed = Number(value);
			if (!Number.isFinite(parsed) || parsed < 0) {
				throw new BadRequestError(`${field} must be a valid number greater than or equal to 0`);
			}
			return parsed;
		};
		const parseDate = (value: unknown, field: string) => {
			if (typeof value !== "string") return undefined;
			const parsed = new Date(value);
			if (Number.isNaN(parsed.getTime())) {
				throw new BadRequestError(`${field} must be a valid date`);
			}
			return parsed;
		};
		const parseString = (value: unknown) =>
			typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

		const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
		const workflowStatusRaw =
			typeof req.query.workflowStatus === "string" ? req.query.workflowStatus : undefined;
		const search = parseString(req.query.search);
		const provinceId = parseString(req.query.provinceId);
		const districtId = parseString(req.query.districtId);
		const communeId = parseString(req.query.communeId);
		const villageId = parseString(req.query.villageId);
		const propertyTypeIdRaw = parsePositiveInt(req.query.propertyTypeId, "propertyTypeId");
		const createdById = parsePositiveInt(req.query.createdById, "createdById");
		const minPrice = parseNonNegativeNumber(req.query.minPrice, "minPrice");
		const maxPrice = parseNonNegativeNumber(req.query.maxPrice, "maxPrice");
		const createdAfter = parseDate(req.query.createdAfter, "createdAfter");
		const createdBefore = parseDate(req.query.createdBefore, "createdBefore");

		const normalizedStatus = statusRaw?.trim().toUpperCase();
		const normalizedWorkflowStatus = workflowStatusRaw?.trim().toUpperCase();

		if (
			normalizedStatus &&
			!Object.values(PropertyStatus).includes(normalizedStatus as PropertyStatus)
		) {
			throw new BadRequestError(
				`Invalid status. Allowed values: ${Object.values(PropertyStatus).join(", ")}`
			);
		}

		if (
			normalizedWorkflowStatus &&
			!Object.values(WorkflowStatus).includes(
				normalizedWorkflowStatus as WorkflowStatus
			)
		) {
			throw new BadRequestError(
				`Invalid workflowStatus. Allowed values: ${Object.values(
					WorkflowStatus
				).join(", ")}`
			);
		}

		if (
			minPrice !== undefined &&
			maxPrice !== undefined &&
			minPrice > maxPrice
		) {
			throw new BadRequestError("minPrice cannot be greater than maxPrice");
		}

		if (
			createdAfter &&
			createdBefore &&
			createdAfter > createdBefore
		) {
			throw new BadRequestError("createdAfter cannot be later than createdBefore");
		}

		const buffer = await exportPropertiesToExcel({
			status: normalizedStatus as PropertyStatus | undefined,
			workflowStatus: normalizedWorkflowStatus as WorkflowStatus | undefined,
			propertyTypeId: propertyTypeIdRaw,
			provinceId,
			districtId,
			communeId,
			villageId,
			minPrice,
			maxPrice,
			createdAfter,
			createdBefore,
			createdById,
			search,
		});
		const payload = Buffer.from(buffer);

		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		res.setHeader(
			"Content-Type",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		);
		res.setHeader(
			"Content-Disposition",
			`attachment; filename=\"properties-${timestamp}.xlsx\"`
		);
		return res.status(200).send(payload);
	}

	static async importPropertiesExcel(req: AuthRequest, res: Response) {
		const file = (req as any).file as Express.Multer.File | undefined;
		if (!file) {
			throw new BadRequestError("excelFile is required");
		}

		const summary = await importPropertiesFromExcel(file, req.user?.id);

		return successResponse(
			res,
			200,
			{ summary },
			`Import completed: ${summary.created} created, ${summary.updated} updated, ${summary.failed} failed`
		);
	}

	static async getPropertyById(req: Request, res: Response) {
		const propertyId = Number(req.params.id);
		if (!propertyId || Number.isNaN(propertyId)) throw new BadRequestError("Invalid property ID");
		const property = await propertyService.getPropertyById(propertyId);

		return successResponse(res, 200, { property }, "Property fetched successfully");
	}

	static async createProperty(req: AuthRequest, res: Response) {
		const userId = req.user?.id;
		if (!userId) throw new ForbiddenError("User not authenticated");

		const body = { ...req.body, createdBy: userId };
		const files = req.files as FileField;
		const createdProperty = await propertyService.createProperty(body, files);
		return successResponse(res, 201, { property: createdProperty }, "Property created successfully");
	}

	static async updateProperty(req: AuthRequest, res: Response) {
		const userId = req.user?.id;
		if (!userId) throw new ForbiddenError("Unauthorized");

		const propertyId = Number(req.params.id);
		if (!propertyId || Number.isNaN(propertyId)) throw new BadRequestError("Invalid property ID");

		const files = req.files as FileField;

		const userHierarchyLevel = Math.min(
        ...req.user!.roles.map(r => r.hierarchyLevel)
      );

		const updated = await propertyService.updateProperty(propertyId, req.body, files, userId, userHierarchyLevel);
		return successResponse(res, 200, { property: updated }, "Property updated successfully");
	}

	static async deleteProperty(req: AuthRequest, res: Response) {
		const userId = req.user?.id;
		if (!userId) throw new ForbiddenError("User not authenticated");
		const propertyId = Number(req.params.id);
		if (!propertyId || Number.isNaN(propertyId)) throw new BadRequestError("Invalid property ID");

		const userHierarchyLevel = Math.min(
        ...req.user!.roles.map(r => r.hierarchyLevel)
      );

		await propertyService.deleteProperty(propertyId, userId, userHierarchyLevel);
		return successResponse(res, 200, null, "Property deleted successfully (soft delete)");
	}

	static async deleteTransaction(req: AuthRequest, res: Response) {
		const transactionId = Number(req.params.id);
		if (!transactionId || Number.isNaN(transactionId)) throw new BadRequestError("Invalid transaction ID");
		await propertyService.deleteTransaction(transactionId);
		return successResponse(res, 200, null, "Transaction deleted successfully");
	}

	static async updatePropertyLocation(req: AuthRequest, res: Response) {
		const userId = req.user?.id;
		if (!userId) throw new ForbiddenError("User not authenticated");

		const propertyId = Number(req.params.id);
		if (!propertyId || Number.isNaN(propertyId)) throw new BadRequestError("Invalid property ID");

		const { latitude, longitude } = req.body;
		if (latitude === undefined || longitude === undefined) {
			throw new BadRequestError("Latitude and longitude are required");
		}

		const property = await propertyService.updatePropertyLocation(
			propertyId,
			{ latitude: Number(latitude), longitude: Number(longitude) },
			userId
		);
		return successResponse(res, 200, { property }, "Property location updated successfully");
	}

	static async getPropertiesNearby(req: Request, res: Response) {
		const { latitude, longitude, radius = 5, limit = 20 } = req.query;
		if (!latitude || !longitude) {
			throw new BadRequestError(
				"Latitude and longitude are required as query parameters. Example: /api/properties/nearby?latitude=11.5564&longitude=104.9282"
			);
		}

		const properties = await propertyService.getPropertiesNearLocation(
			Number(latitude),
			Number(longitude),
			Number(radius),
			Number(limit)
		);
		return successResponse(res, 200, {
			center: { latitude: Number(latitude), longitude: Number(longitude) },
			radius: Number(radius),
			properties,
		}, "Nearby properties retrieved successfully");
	}

	static async getPropertyLocationAnalysis(req: Request, res: Response) {
		const propertyId = Number(req.params.id);
		if (!propertyId || Number.isNaN(propertyId)) throw new BadRequestError("Invalid property ID");
		const analysis = await propertyService.getPropertyLocationAnalysis(propertyId);
		return successResponse(res, 200, { analysis }, "Property location analysis retrieved successfully");
	}

	static async getAllPropertyLocations(req: Request, res: Response) {
		const workflowStatusQuery = req.query.workflowStatus as string | undefined;
		const normalizedWorkflowStatus = workflowStatusQuery?.trim().toUpperCase();
		const valuationMethodQuery = req.query.valuationMethod as string | undefined;
		const normalizedValuationMethod = valuationMethodQuery?.trim().toUpperCase();
		const valuationStatusQuery = req.query.valuationStatus as string | undefined;
		const normalizedValuationStatus = valuationStatusQuery?.trim().toUpperCase();

		if (
			normalizedWorkflowStatus &&
			normalizedWorkflowStatus !== "ALL" &&
			!Object.values(WorkflowStatus).includes(
				normalizedWorkflowStatus as WorkflowStatus
			)
		) {
			throw new BadRequestError(
				`Invalid workflowStatus. Allowed values: ${Object.values(
					WorkflowStatus
				).join(", ")}`
			);
		}

		if (
			normalizedValuationMethod &&
			normalizedValuationMethod !== "ALL" &&
			!Object.values(ValuationMethod).includes(
				normalizedValuationMethod as ValuationMethod
			)
		) {
			throw new BadRequestError(
				`Invalid valuationMethod. Allowed values: ${Object.values(
					ValuationMethod
				).join(", ")}`
			);
		}

		if (
			normalizedValuationStatus &&
			normalizedValuationStatus !== "ALL" &&
			!Object.values(PropertyValuationStatus).includes(
				normalizedValuationStatus as PropertyValuationStatus
			)
		) {
			throw new BadRequestError(
				`Invalid valuationStatus. Allowed values: ${Object.values(
					PropertyValuationStatus
				).join(", ")}`
			);
		}

		const filters = {
			search: req.query.search as string,
			status: req.query.status as string,
			workflowStatus:
				normalizedWorkflowStatus &&
				normalizedWorkflowStatus !== "ALL"
					? (normalizedWorkflowStatus as WorkflowStatus)
					: undefined,
			provinceId: req.query.provinceId as string,
			districtId: req.query.districtId as string,
			communeId: req.query.communeId as string,
			villageId: req.query.villageId as string,
			transactionType: req.query.transactionType as string,
			minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
			maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
			hasValuation: req.query.hasValuation === 'true' ? true : req.query.hasValuation === 'false' ? false : undefined,
			hasIndicativeValuation:
				req.query.hasIndicativeValuation === "true"
					? true
					: req.query.hasIndicativeValuation === "false"
						? false
						: undefined,
			minMarketValue: req.query.marketValueMin ? Number(req.query.marketValueMin) : undefined,
			maxMarketValue: req.query.marketValueMax ? Number(req.query.marketValueMax) : undefined,
			valuationStatus:
				normalizedValuationStatus &&
				normalizedValuationStatus !== "ALL"
					? (normalizedValuationStatus as PropertyValuationStatus)
					: undefined,
			valuationMethod:
				normalizedValuationMethod &&
				normalizedValuationMethod !== "ALL"
					? (normalizedValuationMethod as ValuationMethod)
					: undefined,
		};

		const locations = await propertyService.getAllPropertyLocations(filters);

		return successResponse(
			res,
			200,
			{ total: locations.length, locations },
			"Get all property locations successfully"
		);
	}

	static async searchPropertiesInPolygon(req: Request, res: Response) {
  const { coordinates, limit = 50, filters } = req.body;

  if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
    throw new BadRequestError("At least 3 coordinates are required to form a polygon");
  }

  for (const coord of coordinates) {
    if (typeof coord.latitude !== "number" || typeof coord.longitude !== "number") {
      throw new BadRequestError("Each coordinate must have numeric latitude and longitude");
    }
  }

  // UPDATED: service now returns metrics + properties
  const result = await propertyService.getPropertiesInBoundary(coordinates, limit, filters);
  const { metrics, properties } = result as {
    metrics: { areaSqMeters: number; perimeterMeters: number };
    properties: any[];
  };

  return successResponse(
    res,
    200,
    {
      total: properties.length,
      searchArea: {
        type: "polygon",
        points: coordinates.length,
        areaSqMeters: metrics?.areaSqMeters ?? 0,
        perimeterMeters: metrics?.perimeterMeters ?? 0,
      },
      properties,
    },
    "Properties found within polygon boundary"
  );
}

	static async searchPropertiesInCircle(req: Request, res: Response) {
		const { centerLat, centerLng, radiusMeters, limit = 50, filters } = req.body;

		if (!centerLat || !centerLng || !radiusMeters) {
			throw new BadRequestError("centerLat, centerLng, and radiusMeters are required");
		}
		if (typeof centerLat !== "number" || typeof centerLng !== "number" || typeof radiusMeters !== "number") {
			throw new BadRequestError("centerLat, centerLng, and radiusMeters must be numbers");
		}

		const properties = (await propertyService.getPropertiesInCircle(
			centerLat,
			centerLng,
			radiusMeters,
			limit,
			filters
		)) as any[];
		return successResponse(res, 200, {
			total: properties.length,
			searchArea: {
				type: "circle",
				center: { latitude: centerLat, longitude: centerLng },
				radiusMeters,
				radiusKm: (radiusMeters / 1000).toFixed(2),
			},
			properties,
		}, "Properties found within circle boundary");
	}

	static async reverseGeocode (
	  req: Request, res: Response): Promise<void> {
		const { latitude, longitude } = req.body;
	
		if (!latitude || !longitude) {
		  throw new BadRequestError("Latitude and longitude are required");
		}
	
		const result = await googleMapService.reverseGeocode(
		  Number(latitude),
		  Number(longitude)
		);
	
		res.json({
		  status: "success",
		  message: "Coordinates reverse geocoded successfully",
		  data: {
			...result,
			coordinates: {
			  latitude: Number(latitude),
			  longitude: Number(longitude),
			},
			googleMapLink: googleMapService.getGoogleMapLink(
			  Number(latitude),
			  Number(longitude)
			),
		  },
		});
	  }

	/**
	 * =====================================================
	 * PROPERTY APPROVAL WORKFLOW ENDPOINTS
	 * =====================================================
	 */

	/**
	 * Submit property for review
	 * POST /api/properties/:id/submit-for-review
	 */
	static async submitPropertyForReview(req: AuthRequest, res: Response) {
		const userId = req.user?.id;
		const userHierarchyLevel = Math.min(
        ...req.user!.roles.map(r => r.hierarchyLevel)
      );

		if (!userId) throw new ForbiddenError("User not authenticated");

		const propertyId = Number(req.params.id);
		if (!propertyId || Number.isNaN(propertyId)) {
			throw new BadRequestError("Invalid property ID");
		}

		const result = await propertyService.submitPropertyForReview(
			propertyId,
			userId,
			userHierarchyLevel
		);

		return successResponse(res, 200, result.data, result.message);
	}

	/**
	 * Approve property
	 * POST /api/properties/:id/approve
	 */
	static async approveProperty(req: AuthRequest, res: Response) {
		const userId = req.user?.id;
		if (!userId) throw new ForbiddenError("User not authenticated");

		const propertyId = Number(req.params.id);
		if (!propertyId || Number.isNaN(propertyId)) {
			throw new BadRequestError("Invalid property ID");
		}

		const { notes } = req.body;

		const result = await propertyService.approveProperty(propertyId, userId, notes);

		return successResponse(res, 200, result.data, result.message);
	}

	/**
	 * Reject property
	 * POST /api/properties/:id/reject
	 */
	static async rejectProperty(req: AuthRequest, res: Response) {
		const userId = req.user?.id;
		if (!userId) throw new ForbiddenError("User not authenticated");

		const propertyId = Number(req.params.id);
		if (!propertyId || Number.isNaN(propertyId)) {
			throw new BadRequestError("Invalid property ID");
		}

		const { reason } = req.body;
		if (!reason || reason.trim().length === 0) {
			throw new BadRequestError("Rejection reason is required");
		}

		const result = await propertyService.rejectProperty(propertyId, userId, reason);

		return successResponse(res, 200, result.data, result.message);
	}

	/**
	 * Archive property
	 * POST /api/properties/:id/archive
	 */
	static async archiveProperty(req: AuthRequest, res: Response) {
		const userId = req.user?.id;
		if (!userId) throw new ForbiddenError("User not authenticated");

		const propertyId = Number(req.params.id);
		if (!propertyId || Number.isNaN(propertyId)) {
			throw new BadRequestError("Invalid property ID");
		}

		const result = await propertyService.archiveProperty(propertyId, userId);

		return successResponse(res, 200, result.data, result.message);
	}

	/**
	 * Restore archived property
	 * POST /api/properties/:id/restore
	 */
	static async restoreProperty(req: AuthRequest, res: Response) {
		const userId = req.user?.id;
		if (!userId) throw new ForbiddenError("User not authenticated");

		const propertyId = Number(req.params.id);
		if (!propertyId || Number.isNaN(propertyId)) {
			throw new BadRequestError("Invalid property ID");
		}

		const result = await propertyService.restoreProperty(propertyId, userId);

		return successResponse(res, 200, result.data, result.message);
	}

	/**
	 * Reassign property to a different user
	 * POST /api/properties/:id/reassign
	 */
	static async reassignProperty(req: AuthRequest, res: Response) {
		const userId = req.user?.id;
		if (!userId) throw new ForbiddenError("User not authenticated");

		const propertyId = Number(req.params.id);
		if (!propertyId || Number.isNaN(propertyId)) {
			throw new BadRequestError("Invalid property ID");
		}

		const { newCreatorId } = req.body;
		if (!newCreatorId || Number.isNaN(Number(newCreatorId))) {
			throw new BadRequestError("Valid newCreatorId is required");
		}

		const result = await propertyService.reassignProperty(
			propertyId,
			Number(newCreatorId),
			userId
		);

		return successResponse(res, 200, result.data, result.message);
	}

	/**
	 * Get property statistics
	 * GET /api/properties/statistics
	 */
	static async getPropertyStatistics(req: Request, res: Response) {
		const parseString = (value: unknown) =>
			typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

		const filters = {
			startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
			endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
			propertyTypeId: req.query.propertyTypeId ? parseInt(req.query.propertyTypeId as string) : undefined,
			provinceId: parseString(req.query.provinceId),
			status: parseString(req.query.status),
		};

		const statistics = await propertyService.getPropertyStatistics(filters);
		return successResponse(res, 200, statistics.data, statistics.message);
	}
}

