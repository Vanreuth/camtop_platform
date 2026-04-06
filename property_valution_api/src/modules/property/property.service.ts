import {
  Prisma,
  PropertyStatus,
  PropertyIndicativeValuationStatus,
  PropertyValuationStatus,
  SourceTypeEnum,
  TransactionType,
  ValuationMethod,
  WorkflowStatus,
} from "@prisma/client";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { NotFoundError } from "../../common/errors/notFound.error";
import { ForbiddenError } from "../../common/errors/forbidden.error";
import { AppError } from "../../common/errors/app.error";
import config from "../../config";
import { prisma } from "../../db/prisma";
import type {
  CreatePropertyDto,
  UpdatePropertyDto,
  FileField,
  SearchFilters,
  PaginationOptions,
} from "../property/property.dto";
import { validatePropertyData } from "../../common/utils/property.validation";
import { createPropertyCodeService } from "../../services/property/propertyCode.service";
import { createPropertyUploadService } from "../../services/property/propertyUpload.service";
import { createPropertyLocationService } from "../../services/property/propertyLocation.service";
import { FileUploadService } from "../../services/fileUpload.service";
import { GeoJSONPolygon, googleMapService } from "../../services/googleMap.service";
import { propertyEmitter, PropertyEvents } from '../../events/propertyEventEmitter';
import { NotificationService } from "../notification/notification.service";
import { NotificationType } from "@prisma/client";
import {
  calculatePolygonCentroid,
  convertGeoJsonToWKT,
  normalizePolygonData,
} from "../../common/utils/geoHelpers";
import { truncateString } from "../../common/utils/formatters";
import { PricePerSqmCalculator } from "../../common/utils/calculators";
import { DIRECT_UNIT_TYPES } from "../../common/constants/propertyTypes";
import { cacheService } from "../../services/cache/cache.service";
import { cacheKeys } from "../../services/cache/cacheKeys";

const notificationService = new NotificationService();

type PolygonMetricsRow = { areaSqM: number; perimeterM: number };
type PolygonMetrics = { areaSqMeters: number; perimeterMeters: number };
type LocationNumeric = number | string | Prisma.Decimal | null;
type PropertyStatisticsFilters = {
  startDate?: Date;
  endDate?: Date;
  propertyTypeId?: number;
  provinceId?: string;
  status?: string;
};
const propertyCodeService = createPropertyCodeService(prisma as any);
const propertyUploadService = createPropertyUploadService(
  FileUploadService as any,
);
const propertyLocationService = createPropertyLocationService(
  prisma as any,
  googleMapService as any,
);

function toPositiveNumberOrNull(v: any, field: string): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new BadRequestError(`${field} must be a number > 0`);
  return n;
}

const toDateOrUndefined = (
  value: unknown,
  fieldName: string,
): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value as any);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid ISO-8601 date`);
  }
  return parsed;
};

const normalizeGalleryJson = (
  gallery: Prisma.JsonValue | null | undefined,
): string[] | null | undefined => {
  if (gallery === undefined) return undefined;
  if (gallery === null) return null;
  if (Array.isArray(gallery)) {
    return gallery.filter((v): v is string => typeof v === "string");
  }
  if (typeof gallery === "string") return [gallery];
  return null;
};

const truncateStringStrict = (value: string, maxLength: number): string => {
  return truncateString(value, maxLength) ?? value;
};

const extractCoordinatePair = (value: string) => {
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    matchedText: match[0],
  };
};

const createLocationSearchVariants = (searchTerm: string) => {
  const coordinatePair = extractCoordinatePair(searchTerm);
  const withoutCoordinates = coordinatePair
    ? searchTerm.replace(coordinatePair.matchedText, " ").replace(/\s+/g, " ").trim()
    : searchTerm;
  const commaSegments = withoutCoordinates
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  return Array.from(
    new Set(
      [searchTerm, withoutCoordinates, ...commaSegments].filter(
        (value) => value.length > 0,
      ),
    ),
  );
};

const containsInsensitive = (value: string) => ({
  contains: value,
  mode: Prisma.QueryMode.insensitive,
});

const trimToUndefined = (value: string | undefined) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeOptionalDescription = (
  value: unknown,
): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
};

const includeForProperty = {
  propertyAddress: {
    include: { province: true, district: true, commune: true, village: true },
  },
  propertyLocation: true,
  propertyType: true,
  propertySubtype: true,
  currentUse: true,
  titleDocument: true,
  dataSource: true,
  land: true,
  agricultureLand: true,
  propertyPhotos: true,
  building: { include: { buildingUnits: true, buildingSubtype: true } },
  buildingUnits: true,
  transaction: true,
  createdByUser: {
    select: { id: true, username: true, firstName: true, lastName: true, email: true ,profilePicture:true},
  },
} as const;

const selectForPropertyList: Prisma.PropertySelect = {
  propertyId: true,
  propertyCode: true,
  propertyName: true,
  status: true,
  workflowStatus: true,
  createdAt: true,
  propertyType: {
    select: {
      propertyTypeId: true,
      propertyName: true,
    },
  },
  propertyAddress: {
    select: {
      province: {
        select: {
          code: true,
          nameEn: true,
          nameKh: true,
        },
      },
      district: {
        select: {
          code: true,
          nameEn: true,
          nameKh: true,
        },
      },
    },
  },
  transaction: {
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    take: 1,
    select: {
      transactionId: true,
      transactionType: true,
      transactionDate: true,
      totalPrice: true,
      newBuildingCost: true,
      depreciationAmount: true,
      currentBuildingValue: true,
      residualLandValue: true,
      pricePerSqm: true,
      valuationId: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  createdByUser: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      lastLogin: true,
      profilePicture: true,
    },
  },
};

const getGoogleMapLink = (latitude: number, longitude: number): string => {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
};

const settledArray = async <T>(promise: Promise<T[]>) => {
  const result = await Promise.allSettled([promise]);
  return result[0].status === "fulfilled" ? result[0].value : [];
};

const invalidatePropertyStatisticsCache = async () => {
  await cacheService.increment(cacheKeys.property.statisticsVersion);
};

export class PropertyService {
  async getAllProperties(
    filters: SearchFilters,
    pagination: PaginationOptions,
  ) {
    const page = Math.max(1, pagination.page ?? 1);
    const limit = Math.min(100, Math.max(1, pagination.limit ?? 10));
    const skip = (page - 1) * limit;
    const search = trimToUndefined(filters.search);
    const propertyName = trimToUndefined(filters.propertyName);
    const propertyCode = trimToUndefined(filters.propertyCode);

    const where: Prisma.PropertyWhereInput = {
      // If workflowStatus filter is provided, use it; otherwise exclude ARCHIVED
      ...(filters.workflowStatus
        ? { workflowStatus: filters.workflowStatus }
        : { workflowStatus: { not: WorkflowStatus.ARCHIVED } }),
      ...(filters.includeValuated
        ? {}
        : {
            propertyValuation: { none: {} },
            propertyIndicativeValuations: { none: {} },
          }),
      ...(filters.propertyTypeId
        ? { propertyTypeId: filters.propertyTypeId }
        : {}),
      ...(filters.propertySubtypeId
        ? { propertySubtypeId: filters.propertySubtypeId }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(search || propertyName || propertyCode
        ? {
            OR: [
              ...(search
                ? [
                    {
                      propertyName: {
                        ...containsInsensitive(search),
                      },
                    },
                    {
                      propertyCode: {
                        ...containsInsensitive(search),
                      },
                    },
                    {
                      description: {
                        ...containsInsensitive(search),
                      },
                    },
                    {
                      dataSource: {
                        is: {
                          contactName: {
                            ...containsInsensitive(search),
                          },
                        },
                      },
                    },
                    {
                      dataSource: {
                        is: {
                          phoneNumber: {
                            ...containsInsensitive(search),
                          },
                        },
                      },
                    },
                  ]
                : []),
              ...(propertyName
                ? [
                    {
                      propertyName: {
                        ...containsInsensitive(propertyName),
                      },
                    },
                  ]
                : []),
              ...(propertyCode
                ? [
                    {
                      propertyCode: {
                        ...containsInsensitive(propertyCode),
                      },
                    },
                  ]
                : []),
            ],
          }
        : {}),
      ...(filters.provinceId ||
      filters.districtId ||
      filters.communeId ||
      filters.villageId
        ? {
            propertyAddress: {
              is: {
                ...(filters.provinceId
                  ? { provinceId: filters.provinceId }
                  : {}),
                ...(filters.districtId
                  ? { districtId: filters.districtId }
                  : {}),
                ...(filters.communeId ? { communeId: filters.communeId } : {}),
                ...(filters.villageId ? { villageId: filters.villageId } : {}),
              },
            },
          }
        : {}),
      ...(filters.minPrice || filters.maxPrice
        ? {
            transaction: {
              some: {
                ...(filters.minPrice
                  ? { totalPrice: { gte: filters.minPrice } }
                  : {}),
                ...(filters.maxPrice
                  ? { totalPrice: { lte: filters.maxPrice } }
                  : {}),
              },
            },
          }
        : {}),
      ...(filters.minLandArea || filters.maxLandArea
        ? {
            land: {
              is: {
                landAreaSqm: {
                  ...(filters.minLandArea ? { gte: filters.minLandArea } : {}),
                  ...(filters.maxLandArea ? { lte: filters.maxLandArea } : {}),
                },
              },
            },
          }
        : {}),
      ...(filters.createdAfter || filters.createdBefore
        ? {
            createdAt: {
              ...(filters.createdAfter ? { gte: filters.createdAfter } : {}),
              ...(filters.createdBefore ? { lte: filters.createdBefore } : {}),
            },
          }
        : {}),
      ...(filters.createdById ? { createdBy: filters.createdById } : {}),
    };

    const allowedSortBy = new Set([
      "propertyId",
      "createdAt",
      "updatedAt",
      "propertyCode",
      "propertyName",
    ]);
    const sortBy = allowedSortBy.has(pagination.sortBy as string)
      ? (pagination.sortBy as string)
      : "propertyId";
    const sortOrder = pagination.sortOrder === "desc" ? "desc" : "asc";
    const orderBy = { [sortBy]: sortOrder } as any;

    const [items, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: selectForPropertyList,
      }),
      prisma.property.count({ where }),
    ]);

    

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPropertyById(propertyId: number) {
    const property = await prisma.property.findFirst({
      where: { propertyId, workflowStatus: { not: WorkflowStatus.ARCHIVED } },
      include: includeForProperty,
    });
    if (!property) throw new NotFoundError("Property not found");
    return property;
  }

  async computeAreaPerimeter(tx: any, propertyId: number): Promise<PolygonMetricsRow | null> {
  const rows = await tx.$queryRaw<PolygonMetricsRow[]>`
    SELECT
      ST_Area(ST_MakeValid(geom_polygon)::geography)      AS "areaSqM",
      ST_Perimeter(ST_MakeValid(geom_polygon)::geography) AS "perimeterM"
    FROM property_locations
    WHERE property_id = ${propertyId}
      AND geom_polygon IS NOT NULL
    LIMIT 1
  `;
  return rows[0] ?? null;
  }

  async  setPointGeom(tx: any, propertyId: number, lat?: any, lng?: any) {
  if (lat == null || lng == null) return;
  await tx.$executeRaw`
    UPDATE property_locations
    SET geom = ST_SetSRID(ST_MakePoint(${Number(lng)}, ${Number(lat)}), 4326)
    WHERE property_id = ${propertyId}
  `;
}

  async setPolygonGeom(tx: any, propertyId: number, polygonWkt: string) {
  await tx.$executeRaw`
    UPDATE property_locations
    SET geom_polygon = ST_GeomFromText(${polygonWkt}, 4326)
    WHERE property_id = ${propertyId}
  `;
}

  
  async createProperty(
    data: CreatePropertyDto,
    files?: FileField,
    userHierarchyLevel = 99,
  ) {
  if (!data.propertyTypeId) throw new BadRequestError("Property type is required");
  if (!data.createdBy) throw new BadRequestError("Created by user ID is required");
  if (!data.transaction?.totalPrice) throw new BadRequestError("Transaction totalPrice is required");

  const { propertyType } = await validatePropertyData(data);

  const newCode = await propertyCodeService.generateCode(propertyType.propertyName);
  const propertyName = propertyCodeService.buildName(
    data.propertyName,
    propertyType.propertyName,
    newCode
  );

  const actorUserId = data.createdBy;
  if( !actorUserId ) throw new BadRequestError("Unauthorized");
  const isPrivileged = userHierarchyLevel <= 2;

  if (!isPrivileged) {
    if (data.status !== undefined && data.status !== PropertyStatus.ACTIVE) {
      throw new ForbiddenError("Only admins/managers can set property status");
    }

    if (
      data.workflowStatus !== undefined &&
      data.workflowStatus !== WorkflowStatus.DRAFT
    ) {
      throw new ForbiddenError(
        "Only admins/managers can set property workflow status",
      );
    }
  }

  const propertyStatus = isPrivileged
    ? (data.status ?? PropertyStatus.ACTIVE)
    : PropertyStatus.ACTIVE;
  const propertyWorkflowStatus = isPrivileged
    ? (data.workflowStatus ?? WorkflowStatus.DRAFT)
    : WorkflowStatus.DRAFT;


  // Manual overrides (authoritative for “length/height” display)
  const userLengthM = toPositiveNumberOrNull(data.propertyLocation?.userLengthM, "userLengthM");
  const userHeightM = toPositiveNumberOrNull(data.propertyLocation?.userHeightM, "userHeightM");

  // Uploads outside transaction (fine: I/O)
  const photoUrls = await propertyUploadService.uploadPhotos(files);
  const buildingImageMap =
    files && data.building && data.building.length > 0
      ? await propertyUploadService.uploadBuildingImages(files, data.building.length)
      : {};

  const addressContext = await propertyLocationService.validateAddressCodes(data.propertyAddress);

  const locationData = await propertyLocationService.buildCreateLocationData(
    {
      propertyLocation: data.propertyLocation,
      propertyAddress: data.propertyAddress,
    },
    addressContext,
    {
      normalizePolygonData,
      calculatePolygonCentroid,
      truncateString: truncateStringStrict,
    }
  );

  // Inject manual overrides into location create payload
  if (locationData) {
    (locationData as any).userLengthM = userLengthM;
    (locationData as any).userHeightM = userHeightM;
  }

  // Prepare WKT ONCE
  let polygonWkt: string | null = null;
  if (locationData?.polygon) {
    const normalized =
      typeof locationData.polygon === "string"
        ? normalizePolygonData(locationData.polygon)
        : locationData.polygon;

    polygonWkt = convertGeoJsonToWKT(normalized) ?? null;
  }

  const isDirectUnitType = DIRECT_UNIT_TYPES.includes(data.propertyTypeId as any);
  const nestedUnitsFromBuildings = (data.building ?? []).flatMap((b) => b.units ?? []);
  const nestedDirectUnits = isDirectUnitType ? nestedUnitsFromBuildings : [];
  const directUnitsToCreate = [...(data.buildingUnit ?? []), ...nestedDirectUnits];

  // Calculation used in transaction creation
  const calc = PricePerSqmCalculator.calculate(
    data.propertyTypeId,
    Number(data.transaction.totalPrice),
    {
      landAreaSqm: data.land?.landAreaSqm,
      totalSizeByTitleDeed: data.titleDocument?.totalSizeByTitleDeed ?? undefined,
      buildingItems: (data.building ?? []).map((building) => ({
        grossAreaSqm: Number(building.grossAreaSqm ?? 0),
        replacementCostPerSqm: Number(building.replacementCostPerSqm ?? 0),
        constructionPercentage: building.percentageOfConstruction ?? 100,
        effectiveAge: Number(building.effectiveAge ?? 0),
        usefulLife: Number(building.usefulLife ?? 0),
      })),
      buildingUnitItems: [...(data.buildingUnit ?? []), ...nestedUnitsFromBuildings].map(
        (unit) => ({
          floorAreaSqm: Number(unit.floorAreaSqm ?? 0),
          replacementCostPerSqm: Number(unit.replacementCostPerSqm ?? 0),
          effectiveAge: Number(unit.effectiveAge ?? 0),
          usefulLife: Number(unit.usefulLife ?? 0),
        })
      ),
    }
  );

  const transactionDate = toDateOrUndefined(data.transaction.transactionDate, "transactionDate");
  const buildingsToCreate = (data.building ?? [])
    .map((building, originalIndex) => ({ building, originalIndex }))
    .filter(({ building }) => (!isDirectUnitType ? true : !!building.buildingSubtypeId));

  const result = await prisma.$transaction(async (tx) => {
    // Title deed uniqueness check (best is unique index in DB)
    if (data.titleDocument?.titleDeedNo) {
      const existingTitle = await tx.titleDocument.findUnique({
        where: { titleDeedNo: data.titleDocument.titleDeedNo },
        select: { titleDeedNo: true },
      });
      if (existingTitle) {
        throw new BadRequestError(
          `Title deed number "${data.titleDocument.titleDeedNo}" already exists. Please use a unique title deed number.`
        );
      }
    }

    const created = await tx.property.create({
      data: {
        propertyCode: newCode,
        propertyName,
        propertyTypeId: data.propertyTypeId,
        propertySubtypeId: data.propertySubtypeId ?? null,
        currentUseId: data.currentUseId ?? null,
        status: propertyStatus,
        workflowStatus: propertyWorkflowStatus,
        description: normalizeOptionalDescription(data.description) ?? null,
        createdBy: data.createdBy,
        updatedBy: data.createdBy,

        ...(data.propertyAddress
          ? { propertyAddress: { create: data.propertyAddress as any } }
          : {}),

        ...(locationData ? { propertyLocation: { create: locationData as any } } : {}),

        ...(data.titleDocument
          ? {
              titleDocument: {
                create: {
                  ...data.titleDocument,
                  coverPhotoUrl: photoUrls.coverPhotoUrl ?? data.titleDocument.coverPhotoUrl,
                  backSidePhotoUrl:
                    photoUrls.backSidePhotoUrl ?? data.titleDocument.backSidePhotoUrl,
                } as any,
              },
            }
          : {}),

        ...(data.dataSource
          ? {
              dataSource: {
                create: {
                  ...(data.dataSource as any),
                  createdBy: data.createdBy,
                  updateBy: data.createdBy,
                },
              },
            }
          : {}),

        ...(data.land ? { land: { create: data.land as any } } : {}),
        ...(data.agricultureLand ? { agricultureLand: { create: data.agricultureLand as any } } : {}),

        propertyPhotos: {
          create: {
            frontSide: photoUrls.frontSide ?? null,
            inside: photoUrls.inside ?? null,
            leftSide: photoUrls.leftSide ?? null,
            rightSide: photoUrls.rightSide ?? null,
            opposite: photoUrls.opposite ?? null,
            gallery: photoUrls.gallery ?? undefined,
          } as any,
        },

        ...(buildingsToCreate.length
          ? {
              building: {
                create: buildingsToCreate.map(({ building, originalIndex }) => {
                  const { units, ...buildingData } = building as any;
                  return {
                    ...buildingData,
                    buildingSubtypeId: building.buildingSubtypeId!,
                    buildingImage: buildingImageMap[originalIndex] ?? building.buildingImage ?? null,
                    buildingUnits: !isDirectUnitType && units?.length
                      ? {
                          create: units.map((unit: any) => ({
                            ...(() => {
                              const resolvedPropertyTypeId =
                                unit.propertyTypeId ?? data.propertyTypeId;
                              const { propertyTypeId, ...unitData } = unit;
                              return {
                                ...unitData,
                                ...(resolvedPropertyTypeId
                                  ? {
                                      propertyType: {
                                        connect: { propertyTypeId: resolvedPropertyTypeId },
                                      },
                                    }
                                  : {}),
                              };
                            })(),
                            property: { connect: { propertyCode: newCode } },
                          })) as any,
                        }
                      : undefined,
                  };
                }) as any,
              },
            }
          : {}),

        ...(directUnitsToCreate.length
          ? {
              buildingUnits: {
                create: directUnitsToCreate.map((unit) => ({
                  ...(() => {
                    const resolvedPropertyTypeId =
                      (unit as any).propertyTypeId ?? data.propertyTypeId;
                    const { propertyTypeId, ...unitData } = unit as any;
                    return {
                      ...unitData,
                      ...(resolvedPropertyTypeId
                        ? {
                            propertyType: {
                              connect: { propertyTypeId: resolvedPropertyTypeId },
                            },
                          }
                        : {}),
                    };
                  })(),
                })) as any,
              },
            }
          : {}),

        transaction: {
          create: {
            transactionType: data.transaction.transactionType,
            transactionDate: transactionDate as Date,
            totalPrice: data.transaction.totalPrice as any,
            valuationId: data.transaction.valuationId ?? null,
            pricePerSqm: calc.pricePerSqm ?? null,
            newBuildingCost: calc.residualCalculation?.newBuildingCost ?? null,
            depreciationAmount: calc.residualCalculation?.depreciationAmount ?? null,
            currentBuildingValue: calc.residualCalculation?.currentBuildingValue ?? null,
            residualLandValue: calc.residualCalculation?.residualLandValue ?? null,
          } as any,
        },
      },
      include: includeForProperty,
    });

    // 1) Set point geom
    await this.setPointGeom(tx, created.propertyId, locationData?.latitude, locationData?.longitude);

    // 2) Set polygon geom + compute area/perimeter and persist
    let polygonMetrics: PolygonMetrics | null = null;

    if (polygonWkt) {
      await this.setPolygonGeom(tx, created.propertyId, polygonWkt);

      const m = await this.computeAreaPerimeter(tx, created.propertyId);
      if (m) {
        await tx.propertyLocation.update({
          where: { propertyId: created.propertyId },
          data: { areaSqM: m.areaSqM, perimeterM: m.perimeterM },
        });

        polygonMetrics = { areaSqMeters: m.areaSqM, perimeterMeters: m.perimeterM };
      }
    }

    return { property: created, polygonMetrics };
  });

  await invalidatePropertyStatisticsCache();

  return result;
}

  async updateProperty(
    propertyId: number,
    data: UpdatePropertyDto,
    files: FileField | undefined,
    userId: number,
    userHierarchyLevel: number,
    userPermissions: string[] = [],
  ) {
    const existing = await prisma.property.findFirst({
      where: { propertyId, workflowStatus: { not: WorkflowStatus.ARCHIVED } },
      include: {
        propertyPhotos: true,
        titleDocument: true,
        building: true,
        land: true,
        agricultureLand: true,
        propertyAddress: true,
        propertyLocation: true,
        buildingUnits: true,
        dataSource: true,
      },
    });
    if (!existing) throw new NotFoundError("Property not found");

    const isOwner = existing.createdBy === userId;
    const isAdminOrManager = userHierarchyLevel <= 2;
    const hasExplicitUpdatePermission =
      userPermissions.includes("property:update") ||
      userPermissions.includes("property:manage");

    // 2. Permission Check (Owner OR Admin/Manager OR explicit property update permission)
    if (!isOwner && !isAdminOrManager && !hasExplicitUpdatePermission) {
      throw new ForbiddenError("You do not have permission to update this property");
    }

    if (!isAdminOrManager) {
      if (data.status !== undefined && data.status !== existing.status) {
        throw new ForbiddenError("Only admins/managers can change property status");
      }

      if (
        data.workflowStatus !== undefined &&
        data.workflowStatus !== existing.workflowStatus
      ) {
        throw new ForbiddenError(
          "Only admins/managers can change property workflow status",
        );
      }
    }

  // 3. Status Lock Check
  // Admins/Managers (level <= 2) can usually bypass the "Draft/Rejected" requirement
  const canBypassStatusLock = userHierarchyLevel <= 2; 

  if (!canBypassStatusLock && 
      existing.workflowStatus !== WorkflowStatus.DRAFT && 
      existing.workflowStatus !== WorkflowStatus.REJECTED &&
      data.status &&
      data.status !== existing.status
  ) {
    throw new BadRequestError(
      `Cannot update property in '${existing.workflowStatus}' status. Withdraw the submission first.`
    );
  }
  
  // Auto-convert REJECTED to DRAFT when editing (like propertyValuation)
  let newWorkflowStatus: WorkflowStatus | undefined = data.workflowStatus;
  if (
    existing.workflowStatus === WorkflowStatus.REJECTED &&
    newWorkflowStatus === undefined
  ) {
    newWorkflowStatus = WorkflowStatus.DRAFT;
  }

    if (
      data.propertyTypeId !== undefined ||
      data.propertySubtypeId !== undefined ||
      data.currentUseId !== undefined ||
      data.land !== undefined ||
      data.agricultureLand !== undefined ||
      (data.building as any) !== undefined ||
      (data.buildingUnit as any) !== undefined
    ) {
      await validatePropertyData({
        // Required core fields
        propertyTypeId: (data.propertyTypeId ?? existing.propertyTypeId) as any,
        propertySubtypeId: (data.propertySubtypeId ??
          existing.propertySubtypeId) as any,
        currentUseId: (data.currentUseId ?? existing.currentUseId) as any,
        status: (data.status ?? existing.status) as any,
        description:
          data.description === undefined
            ? (existing.description as any)
            : ((normalizeOptionalDescription(data.description) ?? undefined) as any),
        propertyName: (data.propertyName ?? existing.propertyName) as any,

        // Preserve existing related entities if caller doesn't provide them
        propertyAddress: (data.propertyAddress ??
          existing.propertyAddress) as any,
        propertyLocation: (data.propertyLocation ??
          existing.propertyLocation) as any,
        titleDocument: (data.titleDocument ?? existing.titleDocument) as any,
        dataSource: (data.dataSource ?? (existing as any).dataSource) as any,
        land: (data.land ?? existing.land) as any,
        agricultureLand: (data.agricultureLand ??
          existing.agricultureLand) as any,
        building: ((data.building as any) ?? existing.building) as any,
        buildingUnit: ((data.buildingUnit as any) ??
          existing.buildingUnits) as any,

        // Create schema requires transaction, but update does not; provide a stub if missing.
        transaction: (data.transaction ?? {
          transactionType: "SALE",
          transactionDate: new Date(),
          totalPrice: 1,
        }) as any,
      } as any);
    }

    const updatedName =
      data.propertyName !== undefined ? data.propertyName : undefined;

    const existingPhotosForUpload = existing.propertyPhotos
      ? {
          frontSide: existing.propertyPhotos.frontSide,
          inside: existing.propertyPhotos.inside,
          leftSide: existing.propertyPhotos.leftSide,
          rightSide: existing.propertyPhotos.rightSide,
          opposite: existing.propertyPhotos.opposite,
          gallery: normalizeGalleryJson(existing.propertyPhotos.gallery),
        }
      : null;

    const photoUrls = await propertyUploadService.updatePhotos({
      files,
      existingProperty: {
        propertyPhotos: existingPhotosForUpload,
        titleDocument: existing.titleDocument,
        building: existing.building,
      },
      deletedImages: data.deletedImages,
    });

    const addressContext = await propertyLocationService.getAddressContext(
      data.propertyAddress ?? existing.propertyAddress,
    );
    const locationData = await propertyLocationService.buildUpdateLocationData(
      {
        propertyLocation: data.propertyLocation,
        propertyAddress: data.propertyAddress,
      },
      addressContext,
      {
        normalizePolygonData,
        calculatePolygonCentroid,
        truncateString: truncateStringStrict,
      },
    );

    const nextPropertyTypeId = data.propertyTypeId ?? existing.propertyTypeId;
    const isDirectUnitType = DIRECT_UNIT_TYPES.includes(nextPropertyTypeId as any);

    const calc = data.transaction
      ? (() => {
          const buildingsForCalc = ((data.building as any) ??
            existing.building ??
            []) as Array<any>;

          const nestedUnitsFromBuildings = Array.isArray(data.building)
            ? (data.building as Array<any>).flatMap((building) => building.units ?? [])
            : [];

          const hasExplicitUnitPayload =
            (data.buildingUnit as any) !== undefined ||
            nestedUnitsFromBuildings.length > 0;

          const unitsForCalc = (
            hasExplicitUnitPayload
              ? [...((data.buildingUnit as any) ?? []), ...nestedUnitsFromBuildings]
              : (existing.buildingUnits as any)
          ) as Array<any>;

          return PricePerSqmCalculator.calculate(
            data.propertyTypeId ?? existing.propertyTypeId,
            Number(data.transaction.totalPrice),
            {
              landAreaSqm:
                (data.land as any)?.landAreaSqm ?? (existing.land as any)?.landAreaSqm,
              totalSizeByTitleDeed:
                (data.titleDocument as any)?.totalSizeByTitleDeed ??
                (existing.titleDocument as any)?.totalSizeByTitleDeed,
              buildingItems: buildingsForCalc.map((building) => ({
                grossAreaSqm: Number(building?.grossAreaSqm ?? 0),
                replacementCostPerSqm: Number(
                  building?.replacementCostPerSqm ?? 0
                ),
                constructionPercentage: building?.percentageOfConstruction ?? 100,
                effectiveAge: Number(building?.effectiveAge ?? 0),
                usefulLife: Number(building?.usefulLife ?? 0),
              })),
              buildingUnitItems: unitsForCalc.map((unit) => ({
                floorAreaSqm: Number(unit?.floorAreaSqm ?? 0),
                replacementCostPerSqm: Number(unit?.replacementCostPerSqm ?? 0),
                effectiveAge: Number(unit?.effectiveAge ?? 0),
                usefulLife: Number(unit?.usefulLife ?? 0),
              })),
            },
          );
        })()
      : null;

    const updated = await prisma.$transaction(async (tx) => {
      const prop = await tx.property.update({
        where: { propertyId },
        data: {
          propertyTypeId: data.propertyTypeId ?? undefined,
          propertySubtypeId:
            data.propertySubtypeId === undefined
              ? undefined
              : (data.propertySubtypeId ?? null),
          currentUseId:
            data.currentUseId === undefined
              ? undefined
              : (data.currentUseId ?? null),
          status: data.status ?? undefined,
          workflowStatus: newWorkflowStatus ?? undefined,
          description: normalizeOptionalDescription(data.description),
          propertyName: updatedName,
          updatedBy: userId,

          ...(data.propertyAddress
            ? {
                propertyAddress: {
                  upsert: {
                    create: data.propertyAddress as any,
                    update: data.propertyAddress as any,
                  },
                },
              }
            : {}),

          ...(locationData
            ? {
                propertyLocation: {
                  upsert: {
                    create: locationData as any,
                    update: locationData as any,
                  },
                },
              }
            : {}),

          ...(data.titleDocument
            ? {
                titleDocument: {
                  upsert: {
                    create: {
                      ...(data.titleDocument as any),
                      coverPhotoUrl:
                        photoUrls.coverPhotoUrl ??
                        (data.titleDocument as any).coverPhotoUrl,
                      backSidePhotoUrl:
                        photoUrls.backSidePhotoUrl ??
                        (data.titleDocument as any).backSidePhotoUrl,
                    },
                    update: {
                      ...(data.titleDocument as any),
                      ...(photoUrls.coverPhotoUrl !== undefined
                        ? { coverPhotoUrl: photoUrls.coverPhotoUrl }
                        : {}),
                      ...(photoUrls.backSidePhotoUrl !== undefined
                        ? { backSidePhotoUrl: photoUrls.backSidePhotoUrl }
                        : {}),
                    },
                  },
                },
              }
            : {}),

          ...(data.dataSource
            ? {
                dataSource: {
                  upsert: {
                    create: {
                      ...(data.dataSource as any),
                      createdBy: userId,
                      updateBy: userId,
                    },
                    update: {
                      ...(data.dataSource as any),
                      updateBy: userId,
                    },
                  },
                },
              }
            : {}),
          ...(data.land
            ? {
                land: {
                  upsert: {
                    create: data.land as any,
                    update: data.land as any,
                  },
                },
              }
            : {}),
          ...(data.agricultureLand
            ? {
                agricultureLand: {
                  upsert: {
                    create: data.agricultureLand as any,
                    update: data.agricultureLand as any,
                  },
                },
              }
            : {}),

          propertyPhotos: {
            upsert: {
              create: {
                frontSide: photoUrls.frontSide ?? null,
                inside: photoUrls.inside ?? null,
                leftSide: photoUrls.leftSide ?? null,
                rightSide: photoUrls.rightSide ?? null,
                opposite: photoUrls.opposite ?? null,
                gallery: photoUrls.gallery ?? undefined,
              } as any,
              update: {
                ...(photoUrls.frontSide !== undefined
                  ? { frontSide: photoUrls.frontSide }
                  : {}),
                ...(photoUrls.inside !== undefined
                  ? { inside: photoUrls.inside }
                  : {}),
                ...(photoUrls.leftSide !== undefined
                  ? { leftSide: photoUrls.leftSide }
                  : {}),
                ...(photoUrls.rightSide !== undefined
                  ? { rightSide: photoUrls.rightSide }
                  : {}),
                ...(photoUrls.opposite !== undefined
                  ? { opposite: photoUrls.opposite }
                  : {}),
                ...(photoUrls.gallery !== undefined
                  ? { gallery: photoUrls.gallery }
                  : {}),
              } as any,
            },
          },
        },
        include: includeForProperty,
      });

      if (Array.isArray(data.building)) {
        if (isDirectUnitType) {
          // For direct-unit property types, units are stored at property level.
          const directUnitsFromBuildingPayload = data.building.flatMap(
            (building: any) => (Array.isArray(building.units) ? building.units : []),
          );

          await tx.buildingUnit.deleteMany({
            where: { propertyId, buildingId: null },
          });

          for (const unit of directUnitsFromBuildingPayload) {
            const { buildingUnitId: _ignoredUnitId, ...unitData } = unit as any;
            await tx.buildingUnit.create({
              data: {
                ...unitData,
                propertyId,
                buildingId: null,
                propertyTypeId: unitData.propertyTypeId ?? nextPropertyTypeId,
              } as any,
            });
          }
        } else {
          const existingBuildingIds = new Set(
            existing.building.map((building) => building.buildingId),
          );
          const incomingBuildingIds = new Set<number>();

          for (const building of data.building as Array<any>) {
            const { buildingId: rawBuildingId, units, ...buildingData } = building;
            const buildingId =
              Number.isFinite(Number(rawBuildingId)) && Number(rawBuildingId) > 0
                ? Number(rawBuildingId)
                : null;

            let resolvedBuildingId: number;

            if (buildingId && existingBuildingIds.has(buildingId)) {
              await tx.building.update({
                where: { buildingId },
                data: buildingData as any,
              });
              resolvedBuildingId = buildingId;
            } else {
              if (!buildingData.buildingSubtypeId) {
                throw new BadRequestError(
                  "buildingSubtypeId is required when creating a building",
                );
              }

              const createdBuilding = await tx.building.create({
                data: {
                  ...(buildingData as any),
                  propertyId,
                },
                select: { buildingId: true },
              });
              resolvedBuildingId = createdBuilding.buildingId;
            }

            incomingBuildingIds.add(resolvedBuildingId);

            if (Array.isArray(units)) {
              // Explicit units payload replaces existing units for that building.
              await tx.buildingUnit.deleteMany({
                where: { propertyId, buildingId: resolvedBuildingId },
              });

              for (const unit of units as Array<any>) {
                const { buildingUnitId: _ignoredUnitId, ...unitData } = unit;
                await tx.buildingUnit.create({
                  data: {
                    ...(unitData as any),
                    propertyId,
                    buildingId: resolvedBuildingId,
                    propertyTypeId: unitData.propertyTypeId ?? nextPropertyTypeId,
                  } as any,
                });
              }
            }
          }

          const removedBuildingIds = existing.building
            .map((building) => building.buildingId)
            .filter((buildingId) => !incomingBuildingIds.has(buildingId));

          if (removedBuildingIds.length > 0) {
            await tx.buildingUnit.deleteMany({
              where: {
                propertyId,
                buildingId: { in: removedBuildingIds },
              },
            });
            await tx.building.deleteMany({
              where: {
                propertyId,
                buildingId: { in: removedBuildingIds },
              },
            });
          }
        }
      }

      if (Array.isArray(data.buildingUnit)) {
        // Explicit direct building units payload replaces current direct units.
        await tx.buildingUnit.deleteMany({
          where: { propertyId, buildingId: null },
        });

        for (const unit of data.buildingUnit as Array<any>) {
          const { buildingUnitId: _ignoredUnitId, ...unitData } = unit;
          await tx.buildingUnit.create({
            data: {
              ...(unitData as any),
              propertyId,
              buildingId: null,
              propertyTypeId: unitData.propertyTypeId ?? nextPropertyTypeId,
            } as any,
          });
        }
      }

      if (photoUrls.buildingImage && existing.building.length) {
        await tx.building.updateMany({
          where: { propertyId },
          data: { buildingImage: photoUrls.buildingImage },
        });
      }

      if (data.transaction) {
        if (data.transaction.transactionId) {
          await tx.transaction.update({
            where: { transactionId: data.transaction.transactionId },
            data: {
              transactionType: data.transaction.transactionType ?? undefined,
              transactionDate: toDateOrUndefined(
                data.transaction.transactionDate,
                "transactionDate",
              ),
              totalPrice: (data.transaction.totalPrice as any) ?? undefined,
              valuationId: data.transaction.valuationId ?? undefined,
              pricePerSqm: calc?.pricePerSqm ?? undefined,
              newBuildingCost:
                calc?.residualCalculation?.newBuildingCost ?? undefined,
              depreciationAmount:
                calc?.residualCalculation?.depreciationAmount ?? undefined,
              currentBuildingValue:
                calc?.residualCalculation?.currentBuildingValue ?? undefined,
              residualLandValue:
                calc?.residualCalculation?.residualLandValue ?? undefined,
            } as any,
          });
        } else {
          await tx.transaction.create({
            data: {
              propertyId,
              transactionType: data.transaction.transactionType as any,
              transactionDate: toDateOrUndefined(
                data.transaction.transactionDate,
                "transactionDate",
              ) as Date,
              totalPrice: data.transaction.totalPrice as any,
              valuationId: data.transaction.valuationId ?? null,
              pricePerSqm: calc?.pricePerSqm ?? null,
              newBuildingCost:
                calc?.residualCalculation?.newBuildingCost ?? null,
              depreciationAmount:
                calc?.residualCalculation?.depreciationAmount ?? null,
              currentBuildingValue:
                calc?.residualCalculation?.currentBuildingValue ?? null,
              residualLandValue:
                calc?.residualCalculation?.residualLandValue ?? null,
            } as any,
          });
        }
      }

      if (locationData?.latitude != null && locationData?.longitude != null) {
        await tx.$executeRaw`
					UPDATE property_locations
					SET geom = ST_SetSRID(ST_MakePoint(${Number(locationData.longitude)}, ${Number(locationData.latitude)}), 4326)
					WHERE property_id = ${propertyId}
				`;
      }

      if (locationData?.polygon !== undefined) {
        const normalized =
          locationData.polygon === null
            ? null
            : typeof locationData.polygon === "string"
              ? normalizePolygonData(locationData.polygon)
              : locationData.polygon;

        if (normalized === null) {
          await tx.$executeRaw`
						UPDATE property_locations
						SET geom_polygon = NULL
						WHERE property_id = ${propertyId}
					`;
        } else {
          const wkt = convertGeoJsonToWKT(normalized);
          if (wkt) {
            await tx.$executeRaw`
							UPDATE property_locations
							SET geom_polygon = ST_GeomFromText(${wkt}, 4326)
							WHERE property_id = ${propertyId}
						`;
          }
        }
      }

      return prop;
    });

    await invalidatePropertyStatisticsCache();

    return updated;
  }

  async deleteProperty(propertyId: number, userId: number, hierarchyLevel: number) {
    const property = await prisma.property.findFirst({
      where: { propertyId, workflowStatus: { not: WorkflowStatus.ARCHIVED } },
    });
    if (!property) throw new NotFoundError("Property not found");

    const isAdmin = hierarchyLevel <= 2;
    if (!isAdmin && property.workflowStatus !== WorkflowStatus.DRAFT && property.workflowStatus !== WorkflowStatus.REJECTED) {
      throw new BadRequestError(
        `Cannot delete property in '${property.workflowStatus}' status. Withdraw the submission first.`
      );
    }

    await prisma.property.update({
      where: { propertyId },
      data: {
        status: PropertyStatus.INACTIVE,
        workflowStatus: WorkflowStatus.ARCHIVED,
        updatedBy: userId,
      },
    });

    await invalidatePropertyStatisticsCache();

    return { message: "Property deleted successfully" };
  }

  async deleteTransaction(transactionId: number) {
    const tx = await prisma.transaction.findUnique({
      where: { transactionId },
    });
    if (!tx) throw new NotFoundError("Transaction not found");
    await prisma.transaction.delete({ where: { transactionId } });

    await invalidatePropertyStatisticsCache();

    return { message: "Transaction deleted successfully" };
  }

  async updatePropertyLocation(
    propertyId: number,
    coordinates: { latitude: number; longitude: number; polygon?: string },
    userId: number,
  ) {
    const property = await prisma.property.findFirst({
      where: { propertyId, workflowStatus: { not: WorkflowStatus.ARCHIVED } },
    });
    if (!property) throw new NotFoundError("Property not found");

    const locationData: any = {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      googlePoint: `POINT(${coordinates.longitude} ${coordinates.latitude})`,
      geolocationLink: googleMapService.getGoogleMapLink(
        coordinates.latitude,
        coordinates.longitude,
      ),
      ...(coordinates.polygon ? { polygon: coordinates.polygon } : {}),
    };

    await prisma.$executeRaw`
			UPDATE property_locations
			SET geom = ST_SetSRID(ST_MakePoint(${coordinates.longitude}, ${coordinates.latitude}), 4326)
			WHERE property_id = ${propertyId}
		`;

    const updatedProperty = await prisma.property.update({
      where: { propertyId },
      data: {
        updatedBy: userId,
        propertyLocation: {
          upsert: { create: locationData, update: locationData },
        },
      },
      include: includeForProperty,
    });

    return updatedProperty;
  }

  async getPropertiesNearLocation(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
    limit: number = 20,
    filters?: {
      propertyTypeId?: number;
      minPrice?: number;
      maxPrice?: number;
      status?: string;
    },
  ) {
    try {
      const params: any[] = [longitude, latitude, radiusKm * 1000, limit];
      let paramIndex = 5;

      let whereFilters = "";
      if (filters?.propertyTypeId) {
        whereFilters += ` AND p.property_type_id = $${paramIndex}`;
        params.push(filters.propertyTypeId);
        paramIndex++;
      }
      if (filters?.status) {
        whereFilters += ` AND p.status::text = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      let priceFilters = "";
      if (filters?.minPrice) {
        priceFilters += ` AND (SELECT market_value FROM property_valuations pv WHERE pv.property_id = p.property_id ORDER BY pv.valuation_date DESC LIMIT 1) >= $${paramIndex}`;
        params.push(filters.minPrice);
        paramIndex++;
      }
      if (filters?.maxPrice) {
        priceFilters += ` AND (SELECT market_value FROM property_valuations pv WHERE pv.property_id = p.property_id ORDER BY pv.valuation_date DESC LIMIT 1) <= $${paramIndex}`;
        params.push(filters.maxPrice);
        paramIndex++;
      }

      const properties = await prisma.$queryRawUnsafe(
        `
				SELECT 
					p.property_id as "propertyId",
					p.property_name as "propertyName",
					p.property_code as "propertyCode",
					p.status,
					pl.latitude,
					pl.longitude,
					pl.geolocation_link as "geolocationLink",
					pl.formatted_address as "formattedAddress",
					pt.property_name as "propertyTypeName",
					COALESCE(
						(SELECT market_value 
						 FROM property_valuations pv 
						 WHERE pv.property_id = p.property_id 
						 ORDER BY pv.valuation_date DESC 
						 LIMIT 1), 0
					) as "listPrice",
					(
						ST_Distance(
							ST_GeogFromText('POINT(' || pl.longitude || ' ' || pl.latitude || ')'),
							ST_GeogFromText('POINT(' || $1 || ' ' || $2 || ')')
						) / 1000
					)::numeric(10,2) as "distanceKm"
				FROM properties p
				JOIN property_locations pl ON p.property_id = pl.property_id
				LEFT JOIN property_types pt ON p.property_type_id = pt.property_type_id
				WHERE p."workflowStatus" != 'ARCHIVED'
				${whereFilters}
				AND pl.latitude IS NOT NULL
				AND pl.longitude IS NOT NULL
				AND ST_DWithin(
					ST_GeogFromText('POINT(' || pl.longitude || ' ' || pl.latitude || ')'),
					ST_GeogFromText('POINT(' || $1 || ' ' || $2 || ')'),
					$3
				)
				${priceFilters}
				ORDER BY "distanceKm" ASC
				LIMIT $4;
			`,
        ...params,
      );

      return properties;
    } catch (error) {
      console.error("❌ Error in getPropertiesNearLocation:", error);
      throw new AppError("Failed to get nearby properties", 500);
    }
  }

  async getPropertyLocationAnalysis(propertyId: number) {
    const property = await prisma.property.findFirst({
      where: { propertyId, workflowStatus: { not: WorkflowStatus.ARCHIVED } },
      include: {
        propertyLocation: true,
        propertyAddress: {
          include: { province: true, district: true, commune: true },
        },
        propertyType: true,
      },
    });

    if (!property?.propertyLocation)
      throw new NotFoundError("Property location not found");
    const lat = Number(property.propertyLocation.latitude);
    const lng = Number(property.propertyLocation.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestError("Property location coordinates are invalid");
    }

    const nearbyProperties = await settledArray(
      this.getPropertiesNearLocation(lat, lng, 2, 10) as Promise<any[]>,
    );
    const nearbyPropertyItems = (nearbyProperties as any[]).filter(
      (p: any) => Number(p.propertyId) !== property.propertyId,
    );
    const locationScore = this.calculateLocationScore({
      property,
      nearbyPropertiesCount: nearbyPropertyItems.length,
    });

    return {
      property: {
        id: property.propertyId,
        name: property.propertyName,
        code: property.propertyCode,
        type: property.propertyType?.propertyName ?? "Unknown",
        location: property.propertyLocation,
        address: property.propertyAddress,
      },
      nearbyAmenities: {
        schools: [],
        hospitals: [],
        restaurants: [],
        banks: [],
        supermarkets: [],
      },
      nearbyProperties: nearbyPropertyItems.map((p: any) => ({
          id: p.propertyId,
          name: p.propertyName,
          code: p.propertyCode,
          type: p.propertyTypeName,
          distance: Math.round(Number(p.distanceKm ?? 0) * 100) / 100,
          price: p.listPrice,
          status: p.status,
          location: { latitude: p.latitude, longitude: p.longitude },
        })),
      summary: {
        totalNearbySchools: 0,
        totalNearbyHospitals: 0,
        totalNearbyRestaurants: 0,
        totalNearbyBanks: 0,
        totalNearbySupermarkets: 0,
        totalNearbyProperties: nearbyPropertyItems.length,
        locationScore,
        locationRating: this.getLocationRating(locationScore),
      },
    };
  }

  private calculateLocationScore(input: {
    property: {
      propertyLocation?: {
        latitude?: LocationNumeric;
        longitude?: LocationNumeric;
        formattedAddress?: string | null;
        polygon?: unknown;
      } | null;
      propertyAddress?: {
        provinceId?: string | null;
        districtId?: string | null;
        communeId?: string | null;
        villageId?: string | null;
        street?: string | null;
        houseNo?: string | null;
      } | null;
    };
    nearbyPropertiesCount: number;
  }) {
    const location = input.property.propertyLocation;
    const address = input.property.propertyAddress;

    const hasCoordinates =
      location?.latitude != null &&
      location?.longitude != null &&
      Number.isFinite(Number(location.latitude)) &&
      Number.isFinite(Number(location.longitude));
    const hasFormattedAddress = Boolean(location?.formattedAddress?.trim());
    const hasPolygon = Boolean(location?.polygon);

    const addressParts = [
      address?.provinceId,
      address?.districtId,
      address?.communeId,
      address?.villageId,
      address?.street,
      address?.houseNo,
    ].filter((value) => typeof value === "string" && value.trim().length > 0).length;

    const coordinateScore = hasCoordinates ? 35 : 0;
    const addressScore = Math.min(addressParts, 6) * 5;
    const formattedAddressScore = hasFormattedAddress ? 15 : 0;
    const polygonScore = hasPolygon ? 15 : 0;
    const nearbyPropertyScore = Math.min(input.nearbyPropertiesCount, 4) * 5;

    return Math.min(
      100,
      coordinateScore +
        addressScore +
        formattedAddressScore +
        polygonScore +
        nearbyPropertyScore,
    );
  }

  private getLocationRating(score: number) {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Very Good";
    if (score >= 40) return "Good";
    if (score >= 20) return "Fair";
    return "Poor";
  }

  //draws a shape (polygon) on a map and retrieves properties within that shape
  async getPropertiesInBoundary(
    coordinates: { latitude: number; longitude: number }[],
    limit: number = 50,
    filters?: {
      propertyTypeId?: number;
      minPrice?: number;
      maxPrice?: number;
      status?: string;
    },
  ) {
    try {
      if (coordinates.length < 3) {
        throw new BadRequestError(
          "At least 3 coordinates are required to form a polygon",
        );
      }

      const polygonCoords = coordinates
        .map((c) => `${c.longitude} ${c.latitude}`)
        .join(", ");
      const polygonWKT = `POLYGON((${polygonCoords}, ${coordinates[0].longitude} ${coordinates[0].latitude}))`;

      const [shapeMetrics] = await prisma.$queryRawUnsafe<
        { areaSqMeters: number; perimeterMeters: number }[]
      >(
        `
  SELECT
    ST_Area(ST_GeomFromText($1, 4326)::geography)      AS "areaSqMeters",
    ST_Perimeter(ST_GeomFromText($1, 4326)::geography) AS "perimeterMeters"
  `,
        polygonWKT,
      );

      const params: any[] = [polygonWKT, limit];
      let paramIndex = 3;
      let whereFilters = "";

      if (filters?.propertyTypeId) {
        whereFilters += ` AND p.property_type_id = $${paramIndex}`;
        params.push(filters.propertyTypeId);
        paramIndex++;
      }
      if (filters?.status) {
        whereFilters += ` AND p.status::text = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      let priceFilters = "";
      if (filters?.minPrice) {
        priceFilters += ` AND (SELECT market_value FROM property_valuations pv WHERE pv.property_id = p.property_id ORDER BY pv.valuation_date DESC LIMIT 1) >= $${paramIndex}`;
        params.push(filters.minPrice);
        paramIndex++;
      }
      if (filters?.maxPrice) {
        priceFilters += ` AND (SELECT market_value FROM property_valuations pv WHERE pv.property_id = p.property_id ORDER BY pv.valuation_date DESC LIMIT 1) <= $${paramIndex}`;
        params.push(filters.maxPrice);
        paramIndex++;
      }

      const properties = await prisma.$queryRawUnsafe(
        `
				SELECT
					p.property_id as "propertyId",
					p.property_name as "propertyName",
					p.property_code as "propertyCode",
					p.status,
					pl.latitude,
					pl.longitude,
					pl.geolocation_link as "geolocationLink",
					pl.formatted_address as "formattedAddress",
					pt.property_name as "propertyTypeName",
					ST_AsGeoJSON(pl.geom) as "geoJson",
					COALESCE(
						(SELECT market_value FROM property_valuations pv
						 WHERE pv.property_id = p.property_id
						 ORDER BY pv.valuation_date DESC LIMIT 1), 0
					) as "listPrice"
				FROM properties p
				JOIN property_locations pl ON p.property_id = pl.property_id
				LEFT JOIN property_types pt ON p.property_type_id = pt.property_type_id
				WHERE p."workflowStatus" != 'ARCHIVED'
				AND pl.geom IS NOT NULL
				AND ST_Contains(
					ST_GeomFromText($1, 4326),
					pl.geom
				)
				${whereFilters}
				${priceFilters}
				LIMIT $2;
			`,
        ...params,
      );

      return {
  metrics: shapeMetrics ?? { areaSqMeters: 0, perimeterMeters: 0 },
  properties,
};
    } catch (error) {
      console.error("❌ Error in getPropertiesInBoundary:", error);
      throw new AppError("Failed to get properties in boundary", 500);
    }
  }

  //draws a shape (polygon) on a map and retrieves properties within a circular area
  async getPropertiesInCircle(
    centerLat: number,
    centerLng: number,
    radiusMeters: number,
    limit: number = 50,
    filters?: {
      propertyTypeId?: number;
      minPrice?: number;
      maxPrice?: number;
      status?: string;
    },
  ) {
    try {
      if (!centerLat || !centerLng || !radiusMeters) {
        throw new BadRequestError(
          "centerLat, centerLng, and radiusMeters are required",
        );
      }

      if (radiusMeters <= 0 || radiusMeters > 50000) {
        throw new BadRequestError(
          "Radius must be between 1 and 50,000 meters (50km)",
        );
      }

      const params: any[] = [centerLng, centerLat, radiusMeters, limit];
      let paramIndex = 5;
      let whereFilters = "";

      if (filters?.propertyTypeId) {
        whereFilters += ` AND p.property_type_id = $${paramIndex}`;
        params.push(filters.propertyTypeId);
        paramIndex++;
      }
      if (filters?.status) {
        whereFilters += ` AND p.status::text = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      let priceFilters = "";
      if (filters?.minPrice) {
        priceFilters += ` AND (SELECT market_value FROM property_valuations pv WHERE pv.property_id = p.property_id ORDER BY pv.valuation_date DESC LIMIT 1) >= $${paramIndex}`;
        params.push(filters.minPrice);
        paramIndex++;
      }
      if (filters?.maxPrice) {
        priceFilters += ` AND (SELECT market_value FROM property_valuations pv WHERE pv.property_id = p.property_id ORDER BY pv.valuation_date DESC LIMIT 1) <= $${paramIndex}`;
        params.push(filters.maxPrice);
        paramIndex++;
      }

      const properties = await prisma.$queryRawUnsafe(
        `
				SELECT
					p.property_id as "propertyId",
					p.property_name as "propertyName",
					p.property_code as "propertyCode",
					p.status,
					pl.latitude,
					pl.longitude,
					pl.geolocation_link as "geolocationLink",
					pl.formatted_address as "formattedAddress",
					pt.property_name as "propertyTypeName",
					ST_AsGeoJSON(pl.geom) as "geoJson",
					COALESCE(
						(SELECT market_value FROM property_valuations pv
						 WHERE pv.property_id = p.property_id
						 ORDER BY pv.valuation_date DESC LIMIT 1), 0
					) as "listPrice",
					(
						ST_Distance(
							ST_GeogFromText('POINT(' || pl.longitude || ' ' || pl.latitude || ')'),
							ST_GeogFromText('POINT(' || $1 || ' ' || $2 || ')')
						)
					)::numeric(10,2) as "distanceFromCenter"
				FROM properties p
				JOIN property_locations pl ON p.property_id = pl.property_id
				LEFT JOIN property_types pt ON p.property_type_id = pt.property_type_id
				WHERE p."workflowStatus" != 'ARCHIVED'
				AND pl.geom IS NOT NULL
				AND ST_DWithin(
					ST_GeogFromText('POINT(' || pl.longitude || ' ' || pl.latitude || ')'),
					ST_GeogFromText('POINT(' || $1 || ' ' || $2 || ')'),
					$3
				)
				${whereFilters}
				${priceFilters}
				ORDER BY "distanceFromCenter" ASC
				LIMIT $4;
			`,
        ...params,
      );

      return properties;
    } catch (error) {
      console.error("❌ Error in getPropertiesInCircle:", error);
      throw new AppError("Failed to get properties in circle", 500);
    }
  }



  async getAllPropertyLocations(filters?: {
  search?: string;
  status?: string;
  workflowStatus?: WorkflowStatus;
  provinceId?: string;
  districtId?: string;
  communeId?: string;
  villageId?: string;
  transactionType?: string;
  minPrice?: number;
  maxPrice?: number;
  hasValuation?: boolean;
  hasIndicativeValuation?: boolean;
  minMarketValue?: number;
  maxMarketValue?: number;
  valuationStatus?: PropertyValuationStatus;
  valuationMethod?: ValuationMethod;

}): Promise<
  Array<{
    propertyId: number;
    propertyCode: string;
    propertyName: string;
    status?: string;
    workflowStatus?: WorkflowStatus;
    latitude: number;
    longitude: number;
    formattedAddress?: string;
    googleMapLink: string;
    polygon?: GeoJSONPolygon;
    transaction?: Array<{
      transactionType: string;
      totalPrice: number | null;
      transactionDate: Date;
      pricePerSqm: number | null;
    }>;
    titleDocuments?: Array<{
      totalSizeByTitleDeed: number | null;
    }>;
    propertyAddress?: any; 
    propertyType?: {
      propertyTypeId: number;
      propertyName: string;
      recordType?: { recordName: string } | null;
    };
    hasValuation?: boolean;
    hasIndicativeValuation?: boolean;
    valuation?:Array<{
      valuationId: number;
      valuationNo: string;
      marketValue: number | null;
      forcedSaleValue: number | null;
      pricePerSqm: number | null;
      valuationMethod: ValuationMethod | null;
      valuationDate: Date | null;
      status: string | null;
      workflowStatus: WorkflowStatus | null;
      preparedFor: string | null;
      purposeOfValuation: string | null;
    }>;
    indicativeValuation?: Array<{
      valuationId: number;
      indicationNo: string;
      valuationNo: string;
      minMarketValue: number | null;
      maxMarketValue: number | null;
      forcedSaleValue: number | null;
      indicationDate: Date | null;
      status: string | null;
      workflowStatus: WorkflowStatus | null;
      preparedFor: string | null;
      purposeOfValuation: string | null;
    }>;
  }>
> {
  try {
    const hasMin = filters?.minPrice != null;
    const hasMax = filters?.maxPrice != null;
    const hasTxFilter =
      !!filters?.transactionType || hasMin || hasMax;

    const workflowFilter =
      filters?.workflowStatus === WorkflowStatus.APPROVED
        ? {
            OR: [
              { workflowStatus: WorkflowStatus.APPROVED },
              {
                propertyValuation: {
                  some: {
                    workflowStatus: WorkflowStatus.APPROVED,
                    status: PropertyValuationStatus.ACTIVE,
                  },
                },
              },
              {
                propertyIndicativeValuations: {
                  some: {
                    workflowStatus: WorkflowStatus.APPROVED,
                    status: PropertyIndicativeValuationStatus.ACTIVE,
                  },
                },
              },
            ],
          }
        : filters?.workflowStatus
          ? { workflowStatus: filters.workflowStatus }
          : { workflowStatus: { not: WorkflowStatus.ARCHIVED } };

    const where: Prisma.PropertyWhereInput = {
      ...workflowFilter,
      propertyLocation: {
        is: {
          latitude: { not: null },
          longitude: { not: null },
        },
      },
    };

    // Search
    if (filters?.search?.trim()) {
      const searchTerm = filters.search.trim();
      const coordinatePair = extractCoordinatePair(searchTerm);
      const locationSearchVariants = createLocationSearchVariants(searchTerm);
      const normalizedSourceType = searchTerm
        .toUpperCase()
        .replace(/[\s-]+/g, "_");
      const searchConditions: Prisma.PropertyWhereInput[] = [
        { propertyName: containsInsensitive(searchTerm) },
        { propertyCode: containsInsensitive(searchTerm) },
        { description: containsInsensitive(searchTerm) },
        {
          dataSource: {
            is: {
              contactName: containsInsensitive(searchTerm),
            },
          },
        },
        {
          dataSource: {
            is: {
              phoneNumber: containsInsensitive(searchTerm),
            },
          },
        },
        ...(Object.values(SourceTypeEnum).includes(
          normalizedSourceType as SourceTypeEnum
        )
          ? [
              {
                dataSource: {
                  is: {
                    sourceType: normalizedSourceType as SourceTypeEnum,
                  },
                },
              } satisfies Prisma.PropertyWhereInput,
            ]
          : []),
        ...locationSearchVariants.flatMap((variant) => [
          {
            propertyLocation: {
              is: {
                formattedAddress: containsInsensitive(variant),
              },
            },
          },
          {
            propertyLocation: {
              is: {
                geolocationLink: containsInsensitive(variant),
              },
            },
          },
          {
            propertyLocation: {
              is: {
                googlePoint: containsInsensitive(variant),
              },
            },
          },
          {
            propertyLocation: {
              is: {
                placeId: containsInsensitive(variant),
              },
            },
          },
          {
            propertyAddress: {
              is: {
                street: containsInsensitive(variant),
              },
            },
          },
          {
            propertyAddress: {
              is: {
                houseNo: containsInsensitive(variant),
              },
            },
          },
          {
            propertyAddress: {
              is: {
                titleAddress: containsInsensitive(variant),
              },
            },
          },
          {
            propertyAddress: {
              is: {
                accessRoads: containsInsensitive(variant),
              },
            },
          },
          {
            propertyAddress: {
              is: {
                neighborLocation: containsInsensitive(variant),
              },
            },
          },
          {
            propertyAddress: {
              is: {
                province: {
                  is: {
                    OR: [
                      { nameEn: containsInsensitive(variant) },
                      { nameKh: containsInsensitive(variant) },
                    ],
                  },
                },
              },
            },
          },
          {
            propertyAddress: {
              is: {
                district: {
                  is: {
                    OR: [
                      { nameEn: containsInsensitive(variant) },
                      { nameKh: containsInsensitive(variant) },
                    ],
                  },
                },
              },
            },
          },
          {
            propertyAddress: {
              is: {
                commune: {
                  is: {
                    OR: [
                      { nameEn: containsInsensitive(variant) },
                      { nameKh: containsInsensitive(variant) },
                    ],
                  },
                },
              },
            },
          },
          {
            propertyAddress: {
              is: {
                village: {
                  is: {
                    OR: [
                      { nameEn: containsInsensitive(variant) },
                      { nameKh: containsInsensitive(variant) },
                    ],
                  },
                },
              },
            },
          },
        ]),
        ...(coordinatePair
          ? [
              {
                propertyLocation: {
                  is: {
                    latitude: {
                      gte: coordinatePair.latitude - 0.0001,
                      lte: coordinatePair.latitude + 0.0001,
                    },
                    longitude: {
                      gte: coordinatePair.longitude - 0.0001,
                      lte: coordinatePair.longitude + 0.0001,
                    },
                  },
                },
              } satisfies Prisma.PropertyWhereInput,
            ]
          : []),
      ];

      const existingOr = Array.isArray(where.OR) ? where.OR : undefined;
      if (existingOr) {
        delete where.OR;
      }

      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        ...(existingOr ? [{ OR: existingOr }] : []),
        { OR: searchConditions },
      ];
    }

    // Status
    if (
      filters?.status &&
      Object.values(PropertyStatus).includes(filters.status as PropertyStatus)
    ) {
      where.status = filters.status as PropertyStatus;
    }

    const valuationWhere: Prisma.PropertyValuationWhereInput = {};

    // Filter by market value range
    if (filters?.minMarketValue != null || filters?.maxMarketValue != null) {
      valuationWhere.marketValue = {
        ...(filters?.minMarketValue != null && { gte: filters.minMarketValue }),
        ...(filters?.maxMarketValue != null && { lte: filters.maxMarketValue }),
      };
    }

    // Filter by valuation status
    if (filters?.valuationStatus) {
      valuationWhere.status = filters.valuationStatus;
    }

    // Filter by valuation method
    if (filters?.valuationMethod) {
      valuationWhere.valuationMethod = filters.valuationMethod;
    }

    const hasExplicitValuationConstraints = Object.keys(valuationWhere).length > 0;

    if (hasExplicitValuationConstraints || filters?.hasValuation === true) {
      where.propertyValuation = {
        some: hasExplicitValuationConstraints ? valuationWhere : {},
      };
    } else if (filters?.hasValuation === false) {
      where.propertyValuation = {
        none: {},
      };
    }

    if (filters?.hasIndicativeValuation === true) {
      where.propertyIndicativeValuations = {
        some: {},
      };
    } else if (filters?.hasIndicativeValuation === false) {
      where.propertyIndicativeValuations = {
        none: {},
      };
    }

    // Address filters
    if (
      filters?.provinceId ||
      filters?.districtId ||
      filters?.communeId ||
      filters?.villageId
    ) {
      where.propertyAddress = {
        is: {
          ...(filters.provinceId && { provinceId: filters.provinceId }),
          ...(filters.districtId && { districtId: filters.districtId }),
          ...(filters.communeId && { communeId: filters.communeId }),
          ...(filters.villageId && { villageId: filters.villageId }),
        },
      };
    }

    // Transaction filters
    if (hasTxFilter) {
      const transactionType =
        filters?.transactionType &&
        Object.values(TransactionType).includes(
          filters.transactionType as TransactionType,
        )
          ? (filters.transactionType as TransactionType)
          : undefined;

      where.transaction = {
        some: {
          ...(transactionType && { transactionType }),
          ...((hasMin || hasMax) && {
            totalPrice: {
              ...(hasMin && { gte: filters!.minPrice }),
              ...(hasMax && { lte: filters!.maxPrice }),
            },
          }),
        },
      };
    }

    const properties = await prisma.property.findMany({
      where: {
        status: { in: [PropertyStatus.ACTIVE, PropertyStatus.SOLD, PropertyStatus.RENTED, PropertyStatus.RENTAL_SALE] },
        ...where,
      },
      select: {
        propertyId: true,
        propertyCode: true,
        propertyName: true,
        status: true,
        workflowStatus: true,
        propertyType: {
          select: {
            propertyTypeId: true,
            propertyName: true,
            recordType: { select: { recordName: true } },
          },
        },
        transaction: {
          select: {
            transactionType: true,
            totalPrice: true,
            transactionDate: true,
            pricePerSqm: true,
          },
        },

        propertyLocation: {
          select: {
            latitude: true,
            longitude: true,
            formattedAddress: true,
            polygon: true,
          },
        },

        titleDocument: {
          select: { totalSizeByTitleDeed: true },
        },

        propertyAddress: {
          select: {
            street: true,
            houseNo: true,
            titleAddress: true,
            accessRoads: true,
            neighborLocation: true,
            provinceId: true,
            districtId: true,
            communeId: true,
            villageId: true,
            province: { select: { code: true, nameKh: true, nameEn: true } },
            district: { select: { code: true, nameKh: true, nameEn: true } },
            commune: { select: { code: true, nameKh: true, nameEn: true } },
            village: { select: { code: true, nameKh: true, nameEn: true } },
          },
        },
        propertyValuation: {         
           select: {
            valuationId: true,
            valuationNo: true,
            marketValue: true,
            forcedSaleValue: true,
            pricePerSqm: true,
            valuationMethod: true,
            valuationDate: true,
            status: true,
            workflowStatus: true,
            preparedFor: true,
            purposeOfValuation: true,
          },
          orderBy: {
            valuationDate: 'desc' as const,
          },
        },
        propertyIndicativeValuations: {
          select: {
            indicationId: true,
            indicationNo: true,
            forcedSaleValue: true,
            indicationDate: true,
            status: true,
            workflowStatus: true,
            instructedBy: true,
            intendedUse: true,
            components: {
              select: {
                minValue: true,
                maxValue: true,
              },
            },
          },
          orderBy: [
            { indicationDate: "desc" as const },
            { createdAt: "desc" as const },
          ],
        },
      },
    });

    return properties
      .filter(
        (p) =>
          p.propertyLocation?.latitude != null &&
          p.propertyLocation?.longitude != null
      )
      .map((property) => {
        const lat = Number(property.propertyLocation!.latitude);
        const lng = Number(property.propertyLocation!.longitude);

        return {
          propertyId: property.propertyId,
          propertyCode: property.propertyCode,
          propertyName: property.propertyName,
          status: property.status ?? undefined,
          workflowStatus: property.workflowStatus ?? undefined,

          latitude: lat,
          longitude: lng,

          formattedAddress: property.propertyLocation!.formattedAddress ?? undefined,

          googleMapLink: getGoogleMapLink(lat, lng),

          polygon: (property.propertyLocation?.polygon as GeoJSONPolygon) ?? undefined,

          transaction: property.transaction?.map((t) => ({
            transactionType: String(t.transactionType),
            totalPrice: t.totalPrice != null ? Number(t.totalPrice) : null,
            transactionDate: t.transactionDate,
            pricePerSqm: t.pricePerSqm != null ? Number(t.pricePerSqm) : null,
          })),

          titleDocuments: property.titleDocument
            ? [
                {
                  totalSizeByTitleDeed:
                    property.titleDocument.totalSizeByTitleDeed != null
                      ? Number(property.titleDocument.totalSizeByTitleDeed)
                      : null,
                },
              ]
            : undefined,

          propertyAddress: property.propertyAddress
            ? {
                ...property.propertyAddress,
                villageId: property.propertyAddress.villageId ?? undefined,
                province: property.propertyAddress.province ?? null,
                district: property.propertyAddress.district ?? null,
                commune: property.propertyAddress.commune ?? null,
                village: property.propertyAddress.village ?? null,
              }
            : undefined,

          propertyType: property.propertyType
            ? {
                propertyTypeId: property.propertyType.propertyTypeId,
                propertyName: property.propertyType.propertyName,
                recordType: property.propertyType.recordType ?? null,
              }
            : undefined,

          hasValuation:
            (property.propertyValuation?.length ?? 0) > 0,
          hasIndicativeValuation:
            property.propertyIndicativeValuations &&
            property.propertyIndicativeValuations.length > 0,

          valuation: property.propertyValuation?.map((v) => ({
            valuationId: v.valuationId,
            valuationNo: String(v.valuationNo),
            marketValue: v.marketValue != null ? Number(v.marketValue) : null,
            forcedSaleValue: v.forcedSaleValue != null ? Number(v.forcedSaleValue) : null,
            pricePerSqm: v.pricePerSqm != null ? Number(v.pricePerSqm) : null,
            valuationMethod: v.valuationMethod ?? null,
            valuationDate: v.valuationDate ?? null,
            status: v.status ?? null,
            workflowStatus: v.workflowStatus ?? null,
            preparedFor: v.preparedFor ?? null,
            purposeOfValuation: v.purposeOfValuation ?? null,
          })),
          indicativeValuation: property.propertyIndicativeValuations?.map((v) => ({
            ...(() => {
              const totals = (v.components ?? []).reduce(
                (acc, component) => ({
                  min: acc.min + Number(component.minValue ?? 0),
                  max: acc.max + Number(component.maxValue ?? 0),
                }),
                { min: 0, max: 0 },
              );

              return {
                valuationId: v.indicationId,
                indicationNo: String(v.indicationNo),
                valuationNo: String(v.indicationNo),
                minMarketValue: totals.min,
                maxMarketValue: totals.max,
                forcedSaleValue: v.forcedSaleValue != null ? Number(v.forcedSaleValue) : null,
                indicationDate: v.indicationDate ?? null,
                status: v.status ?? null,
                workflowStatus: v.workflowStatus ?? null,
                preparedFor: v.instructedBy ?? null,
                purposeOfValuation: v.intendedUse ?? null,
              };
            })(),
          })),
        };
      });
  } catch (error) {
    console.error("Error getting all property locations:", error);
    throw new Error(
      "Failed to fetch property locations: " + (error as Error).message
    );
  }
}



  async getPropertyStatistics(filters?: {
    startDate?: Date;
    endDate?: Date;
    propertyTypeId?: number;
    provinceId?: string;
    status?: string;
  }) {
    const normalizedFilters: PropertyStatisticsFilters = {
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      propertyTypeId: filters?.propertyTypeId,
      provinceId: trimToUndefined(filters?.provinceId),
      status: trimToUndefined(filters?.status),
    };

    const statisticsVersion =
      (await cacheService.getNumber(cacheKeys.property.statisticsVersion)) ?? 1;
    const statisticsCacheKey = cacheKeys.property.statistics(
      normalizedFilters,
      statisticsVersion,
    );

    return await cacheService.getOrSetJson(
      statisticsCacheKey,
      config.redis.propertyStatsTtlSeconds,
      async () => {
        const whereClause: any = {
          workflowStatus: { not: WorkflowStatus.ARCHIVED },
        };

        if (normalizedFilters.startDate || normalizedFilters.endDate) {
          whereClause.createdAt = {};
          if (normalizedFilters.startDate) whereClause.createdAt.gte = normalizedFilters.startDate;
          if (normalizedFilters.endDate) whereClause.createdAt.lte = normalizedFilters.endDate;
        }
        if (normalizedFilters.propertyTypeId) {
          whereClause.propertyTypeId = normalizedFilters.propertyTypeId;
        }
        if (normalizedFilters.status) {
          whereClause.status = normalizedFilters.status;
        }
        if (normalizedFilters.provinceId) {
          whereClause.propertyAddress = { is: { provinceId: normalizedFilters.provinceId } };
        }

        const propertyStatisticsMonthlyFilterSql = Prisma.sql`
          ${normalizedFilters.startDate ? Prisma.sql`AND created_at >= ${normalizedFilters.startDate}` : Prisma.empty}
          ${normalizedFilters.endDate ? Prisma.sql`AND created_at <= ${normalizedFilters.endDate}` : Prisma.empty}
          ${normalizedFilters.propertyTypeId ? Prisma.sql`AND property_type_id = ${normalizedFilters.propertyTypeId}` : Prisma.empty}
          ${normalizedFilters.status ? Prisma.sql`AND status::text = ${normalizedFilters.status}` : Prisma.empty}
          ${normalizedFilters.provinceId
            ? Prisma.sql`AND EXISTS (
                SELECT 1
                FROM property_address pa
                WHERE pa.property_id = properties.property_id
                  AND pa.province_id = ${normalizedFilters.provinceId}
              )`
            : Prisma.empty}
        `;

        const [
          totalProperties,
          propertiesByStatus,
          propertiesByType,
          propertiesByProvince,
          transactionStats,
          transactionCoverageStats,
          valuationStats,
          valuationCoverageStats,
          indicativeCoverageStats,
          workflowStats,
          propertyMonthlyTrend,
          valuationMonthlyTrend,
          indicativeMonthlyTrend,
        ] = await Promise.all([
          prisma.property.count({ where: whereClause }),
          prisma.property.groupBy({
            by: ["status"],
            where: whereClause,
            _count: { status: true },
          }),
          prisma.property.groupBy({
            by: ["propertyTypeId"],
            where: whereClause,
            _count: { propertyTypeId: true },
            orderBy: { _count: { propertyTypeId: "desc" } },
          }),
          prisma.propertyAddress.groupBy({
            by: ["provinceId"],
            where: {
              property: whereClause,
            },
            _count: { provinceId: true },
            orderBy: { _count: { provinceId: "desc" } },
            take: 10,
          }),
          prisma.transaction.aggregate({
            where: {
              property: whereClause,
            },
            _count: { transactionId: true },
            _avg: { totalPrice: true },
            _min: { totalPrice: true },
            _max: { totalPrice: true },
          }),
          prisma.transaction.groupBy({
            by: ["propertyId"],
            where: {
              property: whereClause,
            },
          }),
          prisma.propertyValuation.aggregate({
            where: {
              property: whereClause,
            },
            _count: { valuationId: true },
            _avg: { marketValue: true },
          }),
          prisma.propertyValuation.groupBy({
            by: ["propertyId"],
            where: {
              property: whereClause,
            },
          }),
          prisma.propertyIndicativeValuation.groupBy({
            by: ["propertyId"],
            where: {
              property: whereClause,
            },
          }),
          prisma.$transaction(async (tx) => {
            const [
              propertyPending,
              propertyApproved,
              propertyRejected,
              propertyDraft,
              valuationPending,
              valuationApproved,
              valuationRejected,
              valuationDraft,
              indicativePending,
              indicativeApproved,
              indicativeRejected,
              indicativeDraft,
            ] = await Promise.all([
              tx.property.count({
                where: { ...whereClause, workflowStatus: WorkflowStatus.PENDING_REVIEW },
              }),
              tx.property.count({
                where: { ...whereClause, workflowStatus: WorkflowStatus.APPROVED },
              }),
              tx.property.count({
                where: { ...whereClause, workflowStatus: WorkflowStatus.REJECTED },
              }),
              tx.property.count({
                where: { ...whereClause, workflowStatus: WorkflowStatus.DRAFT },
              }),
              tx.propertyValuation.count({
                where: {
                  property: whereClause,
                  workflowStatus: WorkflowStatus.PENDING_REVIEW,
                },
              }),
              tx.propertyValuation.count({
                where: {
                  property: whereClause,
                  workflowStatus: WorkflowStatus.APPROVED,
                },
              }),
              tx.propertyValuation.count({
                where: {
                  property: whereClause,
                  workflowStatus: WorkflowStatus.REJECTED,
                },
              }),
              tx.propertyValuation.count({
                where: {
                  property: whereClause,
                  workflowStatus: WorkflowStatus.DRAFT,
                },
              }),
              tx.propertyIndicativeValuation.count({
                where: {
                  property: whereClause,
                  workflowStatus: WorkflowStatus.PENDING_REVIEW,
                },
              }),
              tx.propertyIndicativeValuation.count({
                where: {
                  property: whereClause,
                  workflowStatus: WorkflowStatus.APPROVED,
                },
              }),
              tx.propertyIndicativeValuation.count({
                where: {
                  property: whereClause,
                  workflowStatus: WorkflowStatus.REJECTED,
                },
              }),
              tx.propertyIndicativeValuation.count({
                where: {
                  property: whereClause,
                  workflowStatus: WorkflowStatus.DRAFT,
                },
              }),
            ]);

            const propertyWorkflow = {
              pending: propertyPending,
              approved: propertyApproved,
              rejected: propertyRejected,
              draft: propertyDraft,
            };

            const valuationWorkflow = {
              pending: valuationPending,
              approved: valuationApproved,
              rejected: valuationRejected,
              draft: valuationDraft,
            };

            const indicativeWorkflow = {
              pending: indicativePending,
              approved: indicativeApproved,
              rejected: indicativeRejected,
              draft: indicativeDraft,
            };

            return {
              pending:
                propertyWorkflow.pending +
                valuationWorkflow.pending +
                indicativeWorkflow.pending,
              approved:
                propertyWorkflow.approved +
                valuationWorkflow.approved +
                indicativeWorkflow.approved,
              rejected:
                propertyWorkflow.rejected +
                valuationWorkflow.rejected +
                indicativeWorkflow.rejected,
              draft:
                propertyWorkflow.draft +
                valuationWorkflow.draft +
                indicativeWorkflow.draft,
              avgApprovalDays: null,
              property: propertyWorkflow,
              valuation: valuationWorkflow,
              indicativeValuation: indicativeWorkflow,
            };
          }),
          prisma.$queryRaw<
            { month: string; count: number }[]
          >`
            SELECT
              TO_CHAR(created_at, 'YYYY-MM') as month,
              COUNT(*)::int as count
            FROM properties
            WHERE "workflowStatus" != 'ARCHIVED'
            AND created_at >= NOW() - INTERVAL '12 months'
            ${propertyStatisticsMonthlyFilterSql}
            GROUP BY TO_CHAR(created_at, 'YYYY-MM')
            ORDER BY month DESC
          `,
          prisma.$queryRaw<
            { month: string; count: number }[]
          >`
            SELECT
              TO_CHAR(pv.created_at, 'YYYY-MM') as month,
              COUNT(*)::int as count
            FROM property_valuations pv
            INNER JOIN properties p ON pv.property_id = p.property_id
            WHERE p."workflowStatus" != 'ARCHIVED'
            AND pv.created_at >= NOW() - INTERVAL '12 months'
            ${normalizedFilters.startDate ? Prisma.sql`AND pv.created_at >= ${normalizedFilters.startDate}` : Prisma.empty}
            ${normalizedFilters.endDate ? Prisma.sql`AND pv.created_at <= ${normalizedFilters.endDate}` : Prisma.empty}
            ${normalizedFilters.propertyTypeId ? Prisma.sql`AND p.property_type_id = ${normalizedFilters.propertyTypeId}` : Prisma.empty}
            ${normalizedFilters.status ? Prisma.sql`AND p.status::text = ${normalizedFilters.status}` : Prisma.empty}
            ${normalizedFilters.provinceId
              ? Prisma.sql`AND EXISTS (
                  SELECT 1
                  FROM property_address pa
                  WHERE pa.property_id = p.property_id
                    AND pa.province_id = ${normalizedFilters.provinceId}
                )`
              : Prisma.empty}
            GROUP BY TO_CHAR(pv.created_at, 'YYYY-MM')
            ORDER BY month DESC
          `,
          prisma.$queryRaw<
            { month: string; count: number }[]
          >`
            SELECT
              TO_CHAR(piv.created_at, 'YYYY-MM') as month,
              COUNT(*)::int as count
            FROM property_indicative_valuations piv
            INNER JOIN properties p ON piv.property_id = p.property_id
            WHERE p."workflowStatus" != 'ARCHIVED'
            AND piv.created_at >= NOW() - INTERVAL '12 months'
            ${normalizedFilters.startDate ? Prisma.sql`AND piv.created_at >= ${normalizedFilters.startDate}` : Prisma.empty}
            ${normalizedFilters.endDate ? Prisma.sql`AND piv.created_at <= ${normalizedFilters.endDate}` : Prisma.empty}
            ${normalizedFilters.propertyTypeId ? Prisma.sql`AND p.property_type_id = ${normalizedFilters.propertyTypeId}` : Prisma.empty}
            ${normalizedFilters.status ? Prisma.sql`AND p.status::text = ${normalizedFilters.status}` : Prisma.empty}
            ${normalizedFilters.provinceId
              ? Prisma.sql`AND EXISTS (
                  SELECT 1
                  FROM property_address pa
                  WHERE pa.property_id = p.property_id
                    AND pa.province_id = ${normalizedFilters.provinceId}
                )`
              : Prisma.empty}
            GROUP BY TO_CHAR(piv.created_at, 'YYYY-MM')
            ORDER BY month DESC
          `,
        ]);

        const propertyTypeIds = propertiesByType
          .map((pt) => pt.propertyTypeId)
          .filter(Boolean);
        const propertyTypes = await prisma.propertyType.findMany({
          where: { propertyTypeId: { in: propertyTypeIds as number[] } },
          select: { propertyTypeId: true, propertyName: true },
        });
        const typeMap = Object.fromEntries(
          propertyTypes.map((pt) => [pt.propertyTypeId, pt.propertyName]),
        );

        const provinceIds = propertiesByProvince
          .map((pp) => pp.provinceId)
          .filter(Boolean);
        const provinces = await prisma.province.findMany({
          where: { code: { in: provinceIds } },
          select: {
            code: true,
            nameEn: true,
          },
        });

        const byStatus: Record<string, number> = {};
        propertiesByStatus.forEach((item) => {
          byStatus[item.status] = item._count.status;
        });

        const byType = propertiesByType.map((item) => ({
          propertyTypeId: item.propertyTypeId,
          propertyTypeName: item.propertyTypeId
            ? typeMap[item.propertyTypeId]
            : "Unknown",
          count: item._count.propertyTypeId,
        }));

        const byProvince = propertiesByProvince.map((item) => ({
          provinceId: item.provinceId,
          provinceName: item.provinceId
            ? provinces.find((province) => province.code === item.provinceId)?.nameEn
            : "Unknown",
          count: item._count.provinceId,
        }));

        const monthlyMap = new Map<
          string,
          {
            month: string;
            count: number;
            propertyCount: number;
            valuationCount: number;
            indicativeCount: number;
          }
        >();

        propertyMonthlyTrend.forEach((item) => {
          monthlyMap.set(item.month, {
            month: item.month,
            count: item.count,
            propertyCount: item.count,
            valuationCount: 0,
            indicativeCount: 0,
          });
        });

        valuationMonthlyTrend.forEach((item) => {
          const existing = monthlyMap.get(item.month);
          if (existing) {
            existing.valuationCount = item.count;
            return;
          }

          monthlyMap.set(item.month, {
            month: item.month,
            count: 0,
            propertyCount: 0,
            valuationCount: item.count,
            indicativeCount: 0,
          });
        });

        indicativeMonthlyTrend.forEach((item) => {
          const existing = monthlyMap.get(item.month);
          if (existing) {
            existing.indicativeCount = item.count;
            return;
          }

          monthlyMap.set(item.month, {
            month: item.month,
            count: 0,
            propertyCount: 0,
            valuationCount: 0,
            indicativeCount: item.count,
          });
        });

        const monthlyTrend = Array.from(monthlyMap.values()).sort((a, b) =>
          b.month.localeCompare(a.month),
        );

        return {
          success: true,
          message: "Property statistics retrieved successfully",
          data: {
            overview: {
              totalProperties,
              propertiesWithTransactions: transactionCoverageStats.length,
              propertiesWithValuations: valuationCoverageStats.length,
              propertiesWithIndicativeValuations:
                indicativeCoverageStats.length,
            },
            byStatus,
            byType,
            byProvince,
            transactions: {
              total: transactionStats._count.transactionId,
              averagePrice: transactionStats._avg.totalPrice
                ? Number(transactionStats._avg.totalPrice)
                : 0,
              minPrice: transactionStats._min.totalPrice
                ? Number(transactionStats._min.totalPrice)
                : 0,
              maxPrice: transactionStats._max.totalPrice
                ? Number(transactionStats._max.totalPrice)
                : 0,
            },
            valuations: {
              total: valuationStats._count.valuationId,
              averageMarketValue: valuationStats._avg.marketValue
                ? Number(valuationStats._avg.marketValue)
                : 0,
            },
            workflow: workflowStats,
            trends: {
              monthly: monthlyTrend,
            },
          },
        };
      },
    );
  } 

    
  /**
   * =====================================================
   * PROPERTY APPROVAL WORKFLOW
   * =====================================================
   */

  /**
   * Submit property for review
   * Changes status from DRAFT -> PENDING_REVIEW
   */
  async submitPropertyForReview(
    propertyId: number,
    userId: number,
    userHierarchyLevel: number
  ) {
    // Get property
    const property = await prisma.property.findUnique({
      where: { propertyId },
      include: {
        createdByUser: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    // Check if property was soft deleted (archived)
    if (property.workflowStatus === WorkflowStatus.ARCHIVED) {
      throw new BadRequestError("Cannot submit archived property for review");
    }

    // Check workflow status - only DRAFT or REJECTED properties can be submitted
    if (
      property.workflowStatus !== WorkflowStatus.DRAFT &&
      property.workflowStatus !== WorkflowStatus.REJECTED
    ) {
      throw new BadRequestError(
        `Only properties with DRAFT or REJECTED workflow status can be submitted for review. Current status: ${property.workflowStatus}`
      );
    }

    // Check ownership (privileged users can submit any property)
    const isPrivileged = userHierarchyLevel <= 2; // Admin and Manager levels
    const isOwner = property.createdBy === userId;

    if (!isPrivileged && !isOwner) {
      throw new ForbiddenError(
        "Only the property creator or privileged users can submit for review"
      );
    }

    // Update property workflow status
    const updatedProperty = await prisma.property.update({
      where: { propertyId },
      data: {
        workflowStatus: WorkflowStatus.PENDING_REVIEW,
        updatedBy: userId,
        updatedAt: new Date(),
      },
      include: includeForProperty,
    });

    // Emit event for notification
    propertyEmitter.emit(PropertyEvents.SUBMITTED, {
      property: updatedProperty,
      submittedBy: userId,
    });

    await invalidatePropertyStatisticsCache();

    return {
      success: true,
      message: "Property submitted for review successfully",
      data: updatedProperty,
    };
  }

  /**
   * Approve property
   * Changes workflowStatus from PENDING_REVIEW -> APPROVED
   */
  async approveProperty(
    propertyId: number,
    approvedById: number,
    notes?: string
  ) {
    const property = await prisma.property.findUnique({
      where: { propertyId },
      include: {
        createdByUser: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    if (property.workflowStatus === WorkflowStatus.ARCHIVED) {
      throw new BadRequestError("Cannot approve archived property");
    }

    // Check workflow status
    if (property.workflowStatus !== WorkflowStatus.PENDING_REVIEW) {
      throw new BadRequestError(
        `Only properties with PENDING_REVIEW workflow status can be approved. Current status: ${property.workflowStatus}`
      );
    }

    // Update property
    const updatedProperty = await prisma.property.update({
      where: { propertyId },
      data: {
        workflowStatus: WorkflowStatus.APPROVED,
        approvedBy: approvedById,
        updatedBy: approvedById,
        updatedAt: new Date(),
        ...(notes && {
          description: property.description
            ? `${property.description}\n\nApproval Notes (${new Date().toLocaleDateString()}): ${notes}`
            : `Approval Notes (${new Date().toLocaleDateString()}): ${notes}`,
        }),
      },
      include: includeForProperty,
    });

    // Emit event for notification
    propertyEmitter.emit(PropertyEvents.APPROVED, {
      property: updatedProperty,
      approvedBy: approvedById,
    });

    await invalidatePropertyStatisticsCache();

    return {
      success: true,
      message: "Property approved successfully",
      data: updatedProperty,
    };
  }

  /**
   * Reject property
   * Changes workflowStatus from PENDING_REVIEW -> REJECTED
   */
  async rejectProperty(
    propertyId: number,
    rejectedById: number,
    reason: string
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestError("Rejection reason is required");
    }

    const property = await prisma.property.findUnique({
      where: { propertyId },
      include: {
        createdByUser: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    if (property.workflowStatus === WorkflowStatus.ARCHIVED) {
      throw new BadRequestError("Cannot reject archived property");
    }

    // Check workflow status
    if (property.workflowStatus !== WorkflowStatus.PENDING_REVIEW) {
      throw new BadRequestError(
        `Only properties with PENDING_REVIEW workflow status can be rejected. Current status: ${property.workflowStatus}`
      );
    }

    // Update property
    const updatedProperty = await prisma.property.update({
      where: { propertyId },
      data: {
        workflowStatus: WorkflowStatus.REJECTED,
        rejectedBy: rejectedById,
        rejectionReason: reason,
        updatedBy: rejectedById,
        updatedAt: new Date(),
      },
      include: includeForProperty,
    });

    // Emit event for notification
    propertyEmitter.emit(PropertyEvents.REJECTED, {
      property: updatedProperty,
      rejectedBy: rejectedById,
      reason,
    });

    await invalidatePropertyStatisticsCache();

    return {
      success: true,
      message: "Property rejected successfully",
      data: updatedProperty,
    };
  }

  /**
   * Archive property
   * Changes workflowStatus to ARCHIVED
   */
  async archiveProperty(propertyId: number, userId: number) {
    const property = await prisma.property.findUnique({
      where: { propertyId },
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    if (property.workflowStatus === WorkflowStatus.ARCHIVED) {
      throw new BadRequestError("Property is already archived");
    }

    const updatedProperty = await prisma.property.update({
      where: { propertyId },
      data: {
        workflowStatus: WorkflowStatus.ARCHIVED,
        updatedBy: userId,
        updatedAt: new Date(),
      },
      include: includeForProperty,
    });

    await invalidatePropertyStatisticsCache();

    return {
      success: true,
      message: "Property archived successfully",
      data: updatedProperty,
    };
  }

  /**
   * Restore archived property
   * Changes workflowStatus from ARCHIVED -> DRAFT
   */
  async restoreProperty(propertyId: number, userId: number) {
    const property = await prisma.property.findUnique({
      where: { propertyId },
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    if (property.workflowStatus !== WorkflowStatus.ARCHIVED) {
      throw new BadRequestError("Only archived properties can be restored");
    }

    const updatedProperty = await prisma.property.update({
      where: { propertyId },
      data: {
        workflowStatus: WorkflowStatus.DRAFT,
        updatedBy: userId,
        updatedAt: new Date(),
      },
      include: includeForProperty,
    });

    await invalidatePropertyStatisticsCache();

    return {
      success: true,
      message: "Property restored successfully",
      data: updatedProperty,
    };
  }

  /**
   * Reassign property to a different user
   * Can be used by admins/managers to reassign property ownership
   */
  async reassignProperty(
    propertyId: number,
    newCreatorId: number,
    actorId: number
  ) {
    const property = await prisma.property.findUnique({
      where: { propertyId },
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    if (property.workflowStatus === WorkflowStatus.ARCHIVED) {
      throw new BadRequestError("Cannot reassign archived property");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: newCreatorId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundError("Selected valuer not found");
    }

    const canBeAssigned = targetUser.roles.some((userRole) => {
      const roleCode = userRole.role?.roleCode?.toUpperCase() ?? "";
      return roleCode === "VALUER" || roleCode === "DATA_ENTRY";
    });

    if (!canBeAssigned) {
      throw new BadRequestError(
        "Selected user must have the VALUER or DATA_ENTRY role"
      );
    }

    const updatedProperty = await prisma.property.update({
      where: { propertyId },
      data: {
        createdBy: newCreatorId,
        updatedBy: actorId,
        updatedAt: new Date(),
      },
      include: includeForProperty,
    });

    return {
      success: true,
      message: "Property successfully reassigned",
      data: updatedProperty,
    };
  }

  
}

export const propertyService = new PropertyService();
