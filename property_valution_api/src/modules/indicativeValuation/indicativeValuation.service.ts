import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";
import { NotFoundError } from "../../common/errors/notFound.error";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { ForbiddenError } from "../../common/errors/forbidden.error";
import {
  CreateIndicativeComponentDTO,
  CreateIndicativeValuationDTO,
  UpdateIndicativeComponentDTO,
  UpdateIndicativeValuationDTO,
  ApproveIndicativeValuationDTO,
  RejectIndicativeValuationDTO,
  IndicativeValuationFiltersDTO,
  IndicativeComponentType,
} from "./indicativeValuation.dto";
import {
  IndicativeValuationRepository,
  type IndicativeValuationWithRelations,
} from "./indicativeValuation.repository";
import type { FileField } from "../property/property.dto";
import {
  Prisma,
  PropertyIndicativeValuationStatus,
  PropertyStatus,
  WorkflowStatus,
} from "@prisma/client";
import { prisma } from "../../db/prisma";
import {
  convertGeoJsonToWKT,
  normalizePolygonData,
} from "../../common/utils/geoHelpers";
import { createPropertyCodeService } from "../../services/property/propertyCode.service";
import { createPropertyUploadService } from "../../services/property/propertyUpload.service";
import { FileUploadService } from "../../services/fileUpload.service";
import {
  createIndicativeValuationPdf,
  indicativePdfHelpers,
} from "./indicativeValuation.pdf.service";
import {
  indicativeValuationEmitter,
  IndicativeValuationEvents,
} from "../../events/indicativeValuationEventEmitter";
import {
  computeChargeFee,
  computeChargeFeeRange,
  computeChargeFeeRangeNumber,
  normalizeFeePercent,
  resolveFeeAccessValueRange,
  resolveFeeAccessValueNumber,
  resolveFeeAccessValueRangeNumber,
  sumComponentValueRangeNumber,
  shouldAutoComputeChargeFee,
} from "./indicativeValuation.calculation";
import { invalidatePropertyStatisticsCache } from "../../services/cache/propertyStatisticsCache";

const propertyCodeService = createPropertyCodeService(prisma as any);
const propertyUploadService = createPropertyUploadService(FileUploadService as any);
const repository = new IndicativeValuationRepository();

const COMPONENT_LABELS: Record<IndicativeComponentType, string> = {
  LAND: "Land",
  BUILDING: "Building",
  OTHER: "Other",
};

const AUTO_INDICATION_NO_PREFIX = "IND";
const AUTO_INDICATION_NO_PAD_LENGTH = 6;

function computeValues(area: number, minRate: number, maxRate: number) {
  const normalizedArea = new Decimal(area);

  return {
    minValue: normalizedArea.mul(new Decimal(minRate)),
    maxValue: normalizedArea.mul(new Decimal(maxRate)),
  };
}

function normalizeForcedSalePercent(percent?: number | string | Decimal | null) {
  if (percent === undefined || percent === null || percent === "") return 0;
  const numeric =
    percent instanceof Decimal ? Number(percent) : typeof percent === "string" ? Number(percent) : percent;
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.min(100, Number(numeric.toFixed(2)));
}

function computeForcedSaleValue(maxValue: Decimal | number, percent?: number | string | Decimal | null) {
  const normalizedMaxValue =
    maxValue instanceof Decimal ? maxValue : new Decimal(maxValue);
  return normalizedMaxValue.mul(new Decimal(normalizeForcedSalePercent(percent)).div(new Decimal(100)));
}

function normalizeText(value?: string | null) {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function extractIndicativePdfVersion(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue;

    const normalized = value.split("/").pop() ?? value;
    const match = normalized.match(/v(\d+)\.pdf$/i);
    if (match) {
      const version = Number(match[1]);
      if (Number.isInteger(version) && version > 0) {
        return version;
      }
    }
  }

  return 0;
}

function normalizeRequiredText(value?: string | null) {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function hasNonEmptyText(value?: string | null) {
  return Boolean(value?.trim());
}

function normalizeGalleryJson(
  gallery: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (gallery === undefined) return undefined;
  if (gallery === null) return Prisma.JsonNull;
  if (Array.isArray(gallery)) {
    return gallery.filter((value): value is string => typeof value === "string");
  }
  if (typeof gallery === "string") return [gallery];
  return Prisma.JsonNull;
}

function getComponentLabel(componentType: IndicativeComponentType) {
  return COMPONENT_LABELS[componentType] ?? componentType;
}

function serializeComponent(component: any) {
  const componentType =
    (component.componentType as IndicativeComponentType | undefined) ??
    IndicativeComponentType.LAND;

  return {
    ...component,
    indicationId: component.indicationId,
    valuationId: component.indicationId,
    description: component.description ?? getComponentLabel(componentType),
    unit: "sqm",
  };
}

function serializeIndicativeValuation(record: any) {
  if (!record) return record;

  const rawComponents = record.components ?? record.indicativeComponents ?? [];
  const components = rawComponents.map(serializeComponent);
  const componentTotals = sumComponentValueRangeNumber(rawComponents);
  const minMarketValue = componentTotals.min ?? 0;
  const maxMarketValue = componentTotals.max ?? 0;
  const forcedSalePercent =
    record.forcedSalePercent === null || record.forcedSalePercent === undefined
      ? null
      : normalizeForcedSalePercent(record.forcedSalePercent);
  const forcedSaleValue = Number(
    record.forcedSaleValue ?? computeForcedSaleValue(maxMarketValue, forcedSalePercent)
  );
  const accessValueRange =
    record.minAccessValue != null ||
    record.maxAccessValue != null
      ? {
          min: record.minAccessValue != null ? Number(record.minAccessValue) : null,
          max: record.maxAccessValue != null ? Number(record.maxAccessValue) : null,
        }
      : resolveFeeAccessValueRangeNumber({
          accessValue: record.accessValue,
          fallbackMinAccessValue: minMarketValue,
          fallbackMaxAccessValue: maxMarketValue,
          treatMaxMatchAsAuto: true,
        });
  const accessValue =
    accessValueRange.max ?? resolveFeeAccessValueNumber(record.accessValue, maxMarketValue);
  const feeRate =
    record.feeRate === null || record.feeRate === undefined ? null : normalizeFeePercent(record.feeRate);
  const discount =
    record.discount === null || record.discount === undefined ? null : normalizeFeePercent(record.discount);
  const chargeFeeRange =
    record.minChargeFee != null ||
    record.maxChargeFee != null
      ? {
          min: record.minChargeFee != null ? Number(record.minChargeFee) : null,
          max: record.maxChargeFee != null ? Number(record.maxChargeFee) : null,
        }
      : computeChargeFeeRangeNumber({
          accessValue: record.accessValue,
          fallbackMinAccessValue: minMarketValue,
          fallbackMaxAccessValue: maxMarketValue,
          feeRate: record.feeRate,
          discount: record.discount,
          treatMaxMatchAsAuto: true,
        });
  const computedChargeFee = computeChargeFee({
    accessValue: record.accessValue,
    fallbackAccessValue: maxMarketValue,
    feeRate: record.feeRate,
    discount: record.discount,
  });
  const chargeFee =
    chargeFeeRange.max ??
    (record.chargeFee === null || record.chargeFee === undefined
      ? computedChargeFee === null
        ? null
        : Number(computedChargeFee)
      : Number(record.chargeFee));

  return {
    ...record,
    id: record.indicationId,
    indicationId: record.indicationId,
    valuationId: record.indicationId,
    indicationNo: record.indicationNo,
    valuationNo: record.indicationNo,
    instructionDate: record.instructionDate,
    dateOfInspection: record.instructionDate,
    indicationDate: record.indicationDate,
    valuationDate: record.indicationDate,
    instructedBy: record.instructedBy,
    preparedFor: record.instructedBy,
    contactName: record.contactName ?? record.property?.dataSource?.contactName ?? null,
    contactTel: record.contactTel ?? record.property?.dataSource?.phoneNumber ?? null,
    accessValue,
    minAccessValue: accessValueRange.min,
    maxAccessValue: accessValueRange.max,
    feeRate,
    discount,
    chargeFee,
    minChargeFee:
      chargeFeeRange.min ??
      (record.chargeFee === null || record.chargeFee === undefined ? null : Number(record.chargeFee)),
    maxChargeFee:
      chargeFeeRange.max ??
      (record.chargeFee === null || record.chargeFee === undefined ? null : Number(record.chargeFee)),
    intendedUse: record.intendedUse,
    purposeOfValuation: record.intendedUse,
    approved: record.approvedUser ?? record.approved ?? null,
    rejected: record.rejectedUser ?? record.rejected ?? null,
    components,
    indicativeComponents: components,
    minMarketValue,
    maxMarketValue,
    totalIndicativeMinValue: minMarketValue,
    totalIndicativeMaxValue: maxMarketValue,
    forcedSalePercent,
    forcedSaleValue,
    indicativePdfFileName: record.indicativePdfFileName ?? null,
    indicativePdfMimeType: record.indicativePdfMimeType ?? null,
    indicativePdfFileSize: record.indicativePdfFileSize ?? null,
    indicativePdfGeneratedAt: record.indicativePdfGeneratedAt ?? null,
    hasIndicativePdf: Boolean(record.indicativePdfStorageKey),
  };
}

async function assertValuationExists(indicationId: number) {
  const valuation = await repository.findValuation(indicationId);
  if (!valuation) {
    throw new NotFoundError(`Indicative valuation ${indicationId} not found`);
  }
  return valuation;
}

async function deriveComponentArea(
  client: any,
  propertyId: number,
  componentType: IndicativeComponentType
) {
  if (componentType === IndicativeComponentType.LAND) {
    const titleDocument = await client.titleDocument.findUnique({
      where: { propertyId },
      select: { totalSizeByTitleDeed: true },
    });
    if (titleDocument?.totalSizeByTitleDeed != null) {
      return Number(titleDocument.totalSizeByTitleDeed);
    }
  }

  if (componentType === IndicativeComponentType.BUILDING) {
    const building = await client.building.findFirst({
      where: { propertyId },
      select: { grossAreaSqm: true },
    });
    if (building?.grossAreaSqm != null) {
      return Number(building.grossAreaSqm);
    }
  }

  return undefined;
}

async function refreshTotals(client: any, indicationId: number) {
  const totals = await client.indicativeValuationComponent.aggregate({
    where: { indicationId },
    _sum: { minValue: true, maxValue: true },
  });

  const valuation: any = await client.propertyIndicativeValuation.findUnique({
    where: { indicationId },
    select: {
      forcedSalePercent: true,
      accessValue: true,
      minAccessValue: true,
      maxAccessValue: true,
      feeRate: true,
      discount: true,
      chargeFee: true,
      minChargeFee: true,
      maxChargeFee: true,
    } as any,
  });

  const accessValueRange = resolveFeeAccessValueRange({
    accessValue: valuation?.accessValue,
    fallbackMinAccessValue: totals._sum.minValue ?? new Decimal(0),
    fallbackMaxAccessValue: totals._sum.maxValue ?? new Decimal(0),
    treatMaxMatchAsAuto: true,
  });
  const computedChargeFeeRange = computeChargeFeeRange({
    accessValue: valuation?.accessValue,
    fallbackMinAccessValue: totals._sum.minValue ?? new Decimal(0),
    fallbackMaxAccessValue: totals._sum.maxValue ?? new Decimal(0),
    feeRate: valuation?.feeRate,
    discount: valuation?.discount,
    treatMaxMatchAsAuto: true,
  });
  const computedChargeFee = computeChargeFee({
    accessValue: valuation?.accessValue,
    fallbackAccessValue: totals._sum.maxValue ?? new Decimal(0),
    feeRate: valuation?.feeRate,
    discount: valuation?.discount,
  });

  await client.propertyIndicativeValuation.update({
    where: { indicationId },
    data: {
      minAccessValue: accessValueRange.min,
      maxAccessValue: accessValueRange.max,
      forcedSaleValue: computeForcedSaleValue(
        totals._sum.maxValue ?? new Decimal(0),
        valuation?.forcedSalePercent,
      ),
      chargeFee:
        computedChargeFee ??
        (shouldAutoComputeChargeFee({
          accessValue: valuation?.accessValue,
          feeRate: valuation?.feeRate,
          discount: valuation?.discount,
        })
          ? null
          : valuation?.chargeFee ?? null),
      minChargeFee:
        computedChargeFeeRange.min ??
        (shouldAutoComputeChargeFee({
          accessValue: valuation?.accessValue,
          feeRate: valuation?.feeRate,
          discount: valuation?.discount,
        })
          ? null
          : valuation?.minChargeFee ?? valuation?.chargeFee ?? null),
      maxChargeFee:
        computedChargeFeeRange.max ??
        (shouldAutoComputeChargeFee({
          accessValue: valuation?.accessValue,
          feeRate: valuation?.feeRate,
          discount: valuation?.discount,
        })
          ? null
          : valuation?.maxChargeFee ?? valuation?.chargeFee ?? null),
    } as any,
    select: { indicationId: true },
  });
}

async function getSerializedValuation(indicationId: number) {
  const record = await repository.findWithComponents(indicationId);
  if (!record) {
    throw new NotFoundError(`Indicative valuation ${indicationId} not found`);
  }
  return serializeIndicativeValuation(record);
}

function getIndicativePdfMissingFields(indication: IndicativeValuationWithRelations) {
  const missingFields: string[] = [];

  if (!hasNonEmptyText(indication.instructedBy)) {
    missingFields.push("Instructed By");
  }

  if (!hasNonEmptyText(indication.intendedUse)) {
    missingFields.push("Intended Use");
  }

  if (!indication.instructionDate) {
    missingFields.push("Instruction Date");
  }

  if (!indication.indicationDate) {
    missingFields.push("Indication Date");
  }

  if (!hasNonEmptyText(indication.contactName)) {
    missingFields.push("Contact Name");
  }

  if (!hasNonEmptyText(indication.contactTel)) {
    missingFields.push("Contact Tel");
  }

  if (!hasNonEmptyText(indication.note)) {
    missingFields.push("Note");
  }

  if (!indication.property?.propertyType?.propertyTypeId) {
    missingFields.push("Property Type");
  }

  indication.components.forEach((component: any, index: number) => {
    const componentLabel = `Component ${index + 1}`;

    if (!hasNonEmptyText(component.description)) {
      missingFields.push(`${componentLabel} Description`);
    }

    if (component.area === null || component.area === undefined) {
      missingFields.push(`${componentLabel} Area`);
    }

    if (component.minRate === null || component.minRate === undefined) {
      missingFields.push(`${componentLabel} Min Rate`);
    }

    if (component.maxRate === null || component.maxRate === undefined) {
      missingFields.push(`${componentLabel} Max Rate`);
    }
  });

  return missingFields;
}

function assertIndicativePdfRequiredFields(indication: IndicativeValuationWithRelations) {
  const missingFields = getIndicativePdfMissingFields(indication);

  if (!missingFields.length) return;

  throw new BadRequestError(
    `Cannot generate indicative PDF. Missing required fields: ${missingFields.join(", ")}`
  );
}

function assertIndicativePdfGenerationAllowed(indication: IndicativeValuationWithRelations) {
  if (indication.status !== PropertyIndicativeValuationStatus.ACTIVE) {
    throw new BadRequestError(
      "Indicative PDF can only be generated when status is ACTIVE"
    );
  }

  if (indication.workflowStatus !== WorkflowStatus.APPROVED) {
    throw new BadRequestError(
      "Indicative PDF can only be generated when workflow status is APPROVED"
    );
  }
}

async function generateStoredIndicativePdf(indicationId: number) {
  const indication = await repository.findWithComponents(indicationId);
  if (!indication) {
    throw new NotFoundError(`Indicative valuation ${indicationId} not found`);
  }

  if (!indication.components.length) {
    throw new BadRequestError(
      "Cannot generate indicative PDF without at least one component"
    );
  }

  assertIndicativePdfGenerationAllowed(indication);
  assertIndicativePdfRequiredFields(indication);

  const nextVersion =
    extractIndicativePdfVersion(
      indication.indicativePdfFileName,
      indication.indicativePdfStorageKey,
    ) + 1;
  const { buffer, fileName } = await createIndicativeValuationPdf(indication, nextVersion);
  const storageKey = indicativePdfHelpers.buildPdfStorageKey(indication.indicationNo, nextVersion);
  const publicUrl = indicativePdfHelpers.buildPdfPublicUrl(fileName);

  await FileUploadService.uploadPdfBuffer(buffer, storageKey, "application/pdf");

  const updated = await prisma.propertyIndicativeValuation.update({
    where: { indicationId },
    data: {
      indicativePdfStorageKey: storageKey,
      indicativePdfFileName: fileName,
      indicativePdfMimeType: "application/pdf",
      indicativePdfFileSize: buffer.length,
      indicativePdfGeneratedAt: new Date(),
    },
    select: {
      indicativePdfFileName: true,
      indicativePdfMimeType: true,
      indicativePdfFileSize: true,
      indicativePdfGeneratedAt: true,
    },
  });

  return {
    storageKey,
    fileName: updated.indicativePdfFileName ?? fileName,
    mimeType: updated.indicativePdfMimeType ?? "application/pdf",
    fileSize: updated.indicativePdfFileSize ?? buffer.length,
    generatedAt: updated.indicativePdfGeneratedAt,
    publicUrl,
  };
}

async function buildIndicativePdfLinks(
  storageKey: string,
  fileName: string,
  mimeType: string
) {
  const [viewUrl, downloadUrl] = await Promise.all([
    FileUploadService.signedViewUrl(storageKey, 600, {
      filename: fileName,
      mimeType,
    }),
    FileUploadService.signedDownloadUrl(storageKey, 600, {
      filename: fileName,
    }),
  ]);

  return {
    viewUrl,
    downloadUrl,
    publicUrl: indicativePdfHelpers.buildPdfPublicUrl(fileName),
  };
}

function shouldRegenerateIndicativePdf(
  valuation: {
    indicativePdfStorageKey?: string | null;
    indicativePdfGeneratedAt?: Date | string | null;
  },
  refresh?: boolean
) {
  if (refresh) return true;
  if (!valuation.indicativePdfStorageKey) return true;
  if (!valuation.indicativePdfGeneratedAt) return true;

  const generatedAt = new Date(valuation.indicativePdfGeneratedAt);

  if (Number.isNaN(generatedAt.getTime())) return true;
  return false;
}

function resolveIndicationNo(
  dto: CreateIndicativeValuationDTO | UpdateIndicativeValuationDTO
) {
  return normalizeRequiredText(dto.indicationNo) ?? normalizeRequiredText(dto.valuationNo);
}

function buildAutoIndicationNo(indicationId: number) {
  return `${AUTO_INDICATION_NO_PREFIX}-${String(indicationId).padStart(
    AUTO_INDICATION_NO_PAD_LENGTH,
    "0"
  )}`;
}

function buildTemporaryIndicationNo() {
  return `TMP-IND-${randomUUID()}`;
}

function resolveInstructionDate(
  dto: CreateIndicativeValuationDTO | UpdateIndicativeValuationDTO
) {
  return dto.instructionDate ?? dto.dateOfInspection;
}

function resolveIndicationDate(
  dto: CreateIndicativeValuationDTO | UpdateIndicativeValuationDTO
) {
  return dto.indicationDate ?? dto.valuationDate;
}

function resolveInstructedBy(
  dto: CreateIndicativeValuationDTO | UpdateIndicativeValuationDTO
) {
  return normalizeText(dto.instructedBy) ?? normalizeText(dto.preparedFor);
}

function resolveIntendedUse(
  dto: CreateIndicativeValuationDTO | UpdateIndicativeValuationDTO
) {
  return normalizeText(dto.intendedUse) ?? normalizeText(dto.purposeOfValuation);
}

export const indicativeValuationService = {
  async getAllIndicativeValuations(filters: IndicativeValuationFiltersDTO) {
    const result = await repository.findAll(filters);

    return {
      success: true,
      message: "Indicative valuations retrieved successfully",
      data: result.records.map(serializeIndicativeValuation),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  },

  async getIndicativeValuation(indicationId: number) {
    const data = await getSerializedValuation(indicationId);

    return {
      success: true,
      message: "Indicative valuation retrieved successfully",
      data,
    };
  },

  async getIndicativePdfDocument(
    indicationId: number,
    opts: { refresh?: boolean } = {}
  ) {
    const refresh = opts.refresh ?? false;
    const valuation = await repository.findWithComponents(indicationId);

    if (!valuation) {
      throw new NotFoundError(`Indicative valuation ${indicationId} not found`);
    }

    const shouldRegenerate = shouldRegenerateIndicativePdf(valuation, refresh);

    const storedDocument =
      !shouldRegenerate && valuation.indicativePdfStorageKey
        ? {
            storageKey: valuation.indicativePdfStorageKey,
            fileName:
              valuation.indicativePdfFileName ??
              indicativePdfHelpers.buildPdfFileName(
                valuation.indicationNo,
                Math.max(
                  1,
                  extractIndicativePdfVersion(
                    valuation.indicativePdfFileName,
                    valuation.indicativePdfStorageKey,
                  ),
                ),
              ),
            mimeType: valuation.indicativePdfMimeType ?? "application/pdf",
            fileSize: valuation.indicativePdfFileSize ?? 0,
            generatedAt: valuation.indicativePdfGeneratedAt ?? null,
            publicUrl: indicativePdfHelpers.buildPdfPublicUrl(
              valuation.indicativePdfFileName ??
                indicativePdfHelpers.buildPdfFileName(
                  valuation.indicationNo,
                  Math.max(
                    1,
                    extractIndicativePdfVersion(
                      valuation.indicativePdfFileName,
                      valuation.indicativePdfStorageKey,
                    ),
                  ),
                ),
            ),
          }
        : await generateStoredIndicativePdf(indicationId);

    const { viewUrl, downloadUrl, publicUrl } = await buildIndicativePdfLinks(
      storedDocument.storageKey,
      storedDocument.fileName,
      storedDocument.mimeType
    );

    return {
      success: true,
      message: "Indicative valuation PDF is ready",
      data: {
        indicationId,
        valuationId: indicationId,
        indicationNo: valuation.indicationNo,
        fileName: storedDocument.fileName,
        mimeType: storedDocument.mimeType,
        fileSize: storedDocument.fileSize,
        generatedAt: storedDocument.generatedAt,
        viewUrl,
        downloadUrl,
        publicUrl: storedDocument.publicUrl ?? publicUrl,
      },
    };
  },

  async createIndicativeValuation(
    dto: CreateIndicativeValuationDTO,
    createdBy: number,
    userHierarchyLevel: number,
    files?: FileField
  ) {
    const photoUrls = files ? await propertyUploadService.uploadPhotos(files) : {};
    const isPrivileged = userHierarchyLevel <= 2;
    const requestedWorkflowStatus = isPrivileged ? dto.workflowStatus : undefined;
    const requestedStatus = isPrivileged ? dto.status : undefined;

    if (
      !isPrivileged &&
      dto.workflowStatus !== undefined &&
      dto.workflowStatus !== WorkflowStatus.DRAFT
    ) {
      throw new ForbiddenError("You are not allowed to set the workflow status on create");
    }

    if (
      !isPrivileged &&
      dto.status !== undefined &&
      dto.status !== PropertyIndicativeValuationStatus.ACTIVE
    ) {
      throw new ForbiddenError("You are not allowed to set the business status on create");
    }

    const { indicationId, firstComponentId } = await prisma.$transaction(async (tx) => {
      let propertyId = dto.propertyId;

      if (!propertyId && dto.property) {
        const propertyData = dto.property;
        const propertyType = await tx.propertyType.findUnique({
          where: { propertyTypeId: propertyData.propertyTypeId },
        });

        if (!propertyType) {
          throw new BadRequestError("Property type not found");
        }

        const propertyCode = await propertyCodeService.generateCode(propertyType.propertyName);
        const propertyName = propertyCodeService.buildName(
          propertyData.propertyName,
          propertyType.propertyName,
          propertyCode
        );

        const createdProperty = await tx.property.create({
          data: {
            propertyTypeId: propertyData.propertyTypeId,
            propertySubtypeId: propertyData.propertySubtypeId ?? null,
            currentUseId: propertyData.currentUseId ?? null,
            propertyCode,
            propertyName,
            status: propertyData.status ?? PropertyStatus.ACTIVE,
            workflowStatus: propertyData.workflowStatus ?? WorkflowStatus.DRAFT,
            description: propertyData.description,
            createdBy,
            updatedBy: createdBy,
            ...(propertyData.propertyAddress
              ? { propertyAddress: { create: propertyData.propertyAddress as any } }
              : {}),
            ...(propertyData.propertyLocation
              ? { propertyLocation: { create: propertyData.propertyLocation as any } }
              : {}),
            ...(propertyData.dataSource
              ? {
                  dataSource: {
                    create: {
                      ...propertyData.dataSource,
                      createdBy,
                      updateBy: createdBy,
                    },
                  },
                }
              : {}),
            ...(propertyData.titleDocument
              ? { titleDocument: { create: propertyData.titleDocument } }
              : {}),
            ...(propertyData.propertyPhotos
              ? {
                  propertyPhotos: {
                    create: {
                      frontSide:
                        photoUrls.frontSide ?? propertyData.propertyPhotos.frontSide ?? null,
                      inside: photoUrls.inside ?? propertyData.propertyPhotos.inside ?? null,
                      leftSide: propertyData.propertyPhotos.leftSide ?? null,
                      rightSide: propertyData.propertyPhotos.rightSide ?? null,
                      opposite: propertyData.propertyPhotos.opposite ?? null,
                      gallery: normalizeGalleryJson(propertyData.propertyPhotos.gallery),
                    },
                  },
                }
              : photoUrls.frontSide || photoUrls.inside
                ? {
                    propertyPhotos: {
                      create: {
                        frontSide: photoUrls.frontSide ?? null,
                        inside: photoUrls.inside ?? null,
                        leftSide: null,
                        rightSide: null,
                        opposite: null,
                      },
                    },
                  }
                : {}),
          },
        });

        if (
          propertyData.propertyLocation?.latitude != null &&
          propertyData.propertyLocation?.longitude != null
        ) {
          await tx.$executeRaw`
            UPDATE property_locations
            SET geom = ST_SetSRID(
              ST_MakePoint(${Number(propertyData.propertyLocation.longitude)}, ${Number(
                propertyData.propertyLocation.latitude
              )}),
              4326
            )
            WHERE property_id = ${createdProperty.propertyId}
          `;
        }

        if (propertyData.propertyLocation?.polygon) {
          const normalizedPolygon =
            typeof propertyData.propertyLocation.polygon === "string"
              ? normalizePolygonData(propertyData.propertyLocation.polygon)
              : propertyData.propertyLocation.polygon;
          const wkt = convertGeoJsonToWKT(normalizedPolygon);

          if (wkt) {
            await tx.$executeRaw`
              UPDATE property_locations
              SET geom_polygon = ST_GeomFromText(${wkt}, 4326)
              WHERE property_id = ${createdProperty.propertyId}
            `;
          }
        }

        propertyId = createdProperty.propertyId;
      }

      if (!propertyId) {
        throw new BadRequestError("Property ID is required");
      }

      const componentType = dto.componentType ?? IndicativeComponentType.LAND;
      let resolvedArea: number | undefined = dto.area;

      if (resolvedArea === undefined) {
        resolvedArea = await deriveComponentArea(tx, propertyId, componentType);
      }

      if (resolvedArea === undefined) {
        throw new BadRequestError(
          `Area could not be derived from property data for componentType '${componentType}'. Please provide 'area' explicitly.`
        );
      }

      const { minValue, maxValue } = computeValues(
        resolvedArea,
        dto.minRate,
        dto.maxRate
      );
      const forcedSalePercent = normalizeForcedSalePercent(dto.forcedSalePercent);
      const feeRate = normalizeFeePercent(dto.feeRate);
      const discount = normalizeFeePercent(dto.discount);
      const accessValueRange = resolveFeeAccessValueRange({
        accessValue: dto.accessValue,
        fallbackMinAccessValue: minValue,
        fallbackMaxAccessValue: maxValue,
        treatMaxMatchAsAuto: true,
      });
      const computedChargeFeeRange = computeChargeFeeRange({
        accessValue: dto.accessValue,
        fallbackMinAccessValue: minValue,
        fallbackMaxAccessValue: maxValue,
        feeRate: dto.feeRate,
        discount: dto.discount,
        treatMaxMatchAsAuto: true,
      });
      const computedChargeFee = computeChargeFee({
        accessValue: dto.accessValue,
        fallbackAccessValue: maxValue,
        feeRate: dto.feeRate,
        discount: dto.discount,
      });
      const requestedIndicationNo = resolveIndicationNo(dto);
      const temporaryIndicationNo = requestedIndicationNo ?? buildTemporaryIndicationNo();
      const initialWorkflowStatus = requestedWorkflowStatus ?? WorkflowStatus.DRAFT;
      const initialStatus = requestedStatus ?? PropertyIndicativeValuationStatus.ACTIVE;

      const indication = await tx.propertyIndicativeValuation.create({
        data: {
          property: { connect: { propertyId } },
          indicationNo: temporaryIndicationNo,
          instructionDate: resolveInstructionDate(dto),
          indicationDate: resolveIndicationDate(dto) ?? new Date(),
          instructedBy: resolveInstructedBy(dto),
          intendedUse: resolveIntendedUse(dto),
          contactName: normalizeText(dto.contactName),
          contactTel: normalizeText(dto.contactTel),
          accessValue: dto.accessValue != null ? new Decimal(dto.accessValue) : null,
          minAccessValue: accessValueRange.min,
          maxAccessValue: accessValueRange.max,
          feeRate: dto.feeRate != null ? new Decimal(feeRate) : null,
          discount: dto.discount != null ? new Decimal(discount) : null,
          chargeFee:
            computedChargeFee ??
            (dto.chargeFee != null ? new Decimal(dto.chargeFee) : null),
          minChargeFee:
            computedChargeFeeRange.min ??
            (dto.chargeFee != null ? new Decimal(dto.chargeFee) : null),
          maxChargeFee:
            computedChargeFeeRange.max ??
            (dto.chargeFee != null ? new Decimal(dto.chargeFee) : null),
          forcedSalePercent:
            dto.forcedSalePercent != null ? new Decimal(forcedSalePercent) : null,
          forcedSaleValue: computeForcedSaleValue(maxValue, dto.forcedSalePercent),
          currency: normalizeText(dto.currency)?.toUpperCase() ?? "USD",
          valuer: { connect: { id: dto.valuerId ?? createdBy } },
          inspectorName: normalizeText(dto.inspectorName),
          status: initialStatus,
          workflowStatus: initialWorkflowStatus,
          note: normalizeText(dto.note),
          internalNotes: normalizeText(dto.internalNotes),
          createdByUser: { connect: { id: createdBy } },
          updatedByUser: { connect: { id: createdBy } },
        } as any,
        select: { indicationId: true },
      });

      const indicationNo =
        requestedIndicationNo ?? buildAutoIndicationNo(indication.indicationId);

      if (indicationNo !== temporaryIndicationNo) {
        await tx.propertyIndicativeValuation.update({
          where: { indicationId: indication.indicationId },
          data: { indicationNo },
          select: { indicationId: true },
        });
      }

      const firstComponent = await tx.indicativeValuationComponent.create({
        data: {
          indicationId: indication.indicationId,
          sortOrder: 0,
          componentType,
          description: normalizeText(dto.description) ?? getComponentLabel(componentType),
          area: new Decimal(resolvedArea),
          minRate: new Decimal(dto.minRate),
          maxRate: new Decimal(dto.maxRate),
          minValue,
          maxValue,
        },
      });

      await refreshTotals(tx, indication.indicationId);
      await repository.auditLog(tx, {
        userId: createdBy,
        action: "INDICATIVE_CREATE_VALUATION",
        entityId: indication.indicationId,
        details: {
          propertyId,
          indicationNo,
          componentType,
          area: resolvedArea,
          minRate: dto.minRate,
          maxRate: dto.maxRate,
        },
      });

      return {
        indicationId: indication.indicationId,
        firstComponentId: firstComponent.id,
      };
    });

    const valuation = await getSerializedValuation(indicationId);
    const component =
      valuation.indicativeComponents?.find((item: any) => item.id === firstComponentId) ??
      valuation.indicativeComponents?.[0] ??
      null;

    await invalidatePropertyStatisticsCache();

    return {
      valuation,
      indication: valuation,
      component,
    };
  },

  async submitForReview(
    indicationId: number,
    userId: number,
    userHierarchyLevel: number
  ) {
    const valuation = await assertValuationExists(indicationId);

    if (valuation.workflowStatus !== WorkflowStatus.DRAFT) {
      throw new BadRequestError(
        "Only indicative valuations in DRAFT status can be submitted for review"
      );
    }

    const isPrivileged = userHierarchyLevel <= 2;
    const isOwner = valuation.valuerId === userId;

    if (!isPrivileged && !isOwner) {
      throw new ForbiddenError(
        "Only the assigned valuer or a privileged user can submit for review"
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.propertyIndicativeValuation.update({
        where: { indicationId },
        data: {
          workflowStatus: WorkflowStatus.PENDING_REVIEW,
          updatedByUser: { connect: { id: userId } },
        },
        select: { indicationId: true },
      });

      await repository.auditLog(tx, {
        userId,
        action: "INDICATIVE_SUBMIT_FOR_REVIEW",
        entityId: indicationId,
        details: { workflowStatus: WorkflowStatus.PENDING_REVIEW },
      });
    });

    const result = await getSerializedValuation(indicationId);
    indicativeValuationEmitter.emit(IndicativeValuationEvents.SUBMITTED, {
      valuation: result,
      submittedBy: userId,
    });

    await invalidatePropertyStatisticsCache();

    return {
      success: true,
      message: "Indicative valuation submitted for review",
      data: result,
    };
  },

  async approveValuation(
    indicationId: number,
    dto: ApproveIndicativeValuationDTO,
    approverId: number
  ) {
    const valuation = await assertValuationExists(indicationId);

    if (valuation.workflowStatus !== WorkflowStatus.PENDING_REVIEW) {
      throw new BadRequestError(
        "Only indicative valuations in PENDING_REVIEW status can be approved"
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.propertyIndicativeValuation.updateMany({
        where: {
          propertyId: valuation.propertyId,
          status: PropertyIndicativeValuationStatus.ACTIVE,
          indicationId: { not: indicationId },
        },
        data: {
          status: PropertyIndicativeValuationStatus.SUPERSEDED,
          updatedBy: approverId,
        },
      });

      await tx.propertyIndicativeValuation.update({
        where: { indicationId },
        data: {
          workflowStatus: WorkflowStatus.APPROVED,
          status: PropertyIndicativeValuationStatus.ACTIVE,
          approvedUser: { connect: { id: approverId } },
          updatedByUser: { connect: { id: approverId } },
        },
        select: { indicationId: true },
      });

      await repository.auditLog(tx, {
        userId: approverId,
        action: "INDICATIVE_APPROVE_VALUATION",
        entityId: indicationId,
        details: { notes: dto.notes ?? null },
      });
    });

    const result = await getSerializedValuation(indicationId);
    indicativeValuationEmitter.emit(IndicativeValuationEvents.APPROVED, {
      valuation: result,
      approvedBy: approverId,
      notes: dto.notes,
    });

    await invalidatePropertyStatisticsCache();

    return {
      success: true,
      message: "Indicative valuation approved successfully",
      data: result,
    };
  },

  async rejectValuation(
    indicationId: number,
    dto: RejectIndicativeValuationDTO,
    rejectorId: number
  ) {
    const valuation = await assertValuationExists(indicationId);

    if (valuation.workflowStatus !== WorkflowStatus.PENDING_REVIEW) {
      throw new BadRequestError(
        "Only indicative valuations in PENDING_REVIEW status can be rejected"
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.propertyIndicativeValuation.update({
        where: { indicationId },
        data: {
          workflowStatus: WorkflowStatus.REJECTED,
          rejectedUser: { connect: { id: rejectorId } },
          rejectionReason: dto.rejectionReason,
          updatedByUser: { connect: { id: rejectorId } },
        },
        select: { indicationId: true },
      });

      await repository.auditLog(tx, {
        userId: rejectorId,
        action: "INDICATIVE_REJECT_VALUATION",
        entityId: indicationId,
        details: { rejectionReason: dto.rejectionReason },
      });
    });

    const result = await getSerializedValuation(indicationId);
    indicativeValuationEmitter.emit(IndicativeValuationEvents.REJECTED, {
      valuation: result,
      rejectedBy: rejectorId,
      rejectionReason: dto.rejectionReason,
    });

    await invalidatePropertyStatisticsCache();

    return {
      success: true,
      message: "Indicative valuation rejected",
      data: result,
    };
  },

  async updateIndicativeValuation(
    indicationId: number,
    dto: UpdateIndicativeValuationDTO,
    userId: number,
    userHierarchyLevel: number
  ) {
    const existing: IndicativeValuationWithRelations | null =
      await repository.findWithComponents(indicationId);

    if (!existing) {
      throw new NotFoundError(`Indicative valuation ${indicationId} not found`);
    }

    const canEditApprovedActive =
      existing.workflowStatus === WorkflowStatus.APPROVED &&
      existing.status === PropertyIndicativeValuationStatus.ACTIVE;

    if (
      existing.workflowStatus !== WorkflowStatus.DRAFT &&
      existing.workflowStatus !== WorkflowStatus.REJECTED &&
      !canEditApprovedActive
    ) {
      throw new BadRequestError(
        "Only indicative valuations in DRAFT, REJECTED, or APPROVED with ACTIVE status can be edited"
      );
    }

    const isPrivileged = userHierarchyLevel <= 2;
    const isOwner = existing.valuerId === userId;
    const requestedWorkflowStatus = isPrivileged ? dto.workflowStatus : undefined;
    const requestedStatus = isPrivileged ? dto.status : undefined;

    if (!isPrivileged && !isOwner) {
      throw new ForbiddenError(
        "Only the assigned valuer or a privileged user can edit this indicative valuation"
      );
    }

    if (!isPrivileged && dto.valuerId !== undefined && dto.valuerId !== userId) {
      throw new ForbiddenError("You are not allowed to reassign this indicative valuation");
    }

    if (
      !isPrivileged &&
      dto.workflowStatus !== undefined &&
      dto.workflowStatus !== existing.workflowStatus
    ) {
      throw new ForbiddenError("You are not allowed to change the workflow status");
    }

    if (!isPrivileged && dto.status !== undefined && dto.status !== existing.status) {
      throw new ForbiddenError("You are not allowed to change the business status");
    }

    const primaryComponent = existing.components?.[0] ?? null;
    const propertyId = dto.propertyId ?? existing.propertyId;
    const componentType =
      dto.componentType ??
      (primaryComponent?.componentType as IndicativeComponentType | undefined) ??
      IndicativeComponentType.LAND;

    await prisma.$transaction(async (tx) => {
      if (dto.property) {
        const propertyData = dto.property;

        await tx.property.update({
          where: { propertyId },
          data: {
            ...(propertyData.propertyTypeId !== undefined
              ? { propertyTypeId: propertyData.propertyTypeId }
              : {}),
            ...(propertyData.propertySubtypeId !== undefined
              ? { propertySubtypeId: propertyData.propertySubtypeId ?? null }
              : {}),
            ...(propertyData.currentUseId !== undefined
              ? { currentUseId: propertyData.currentUseId ?? null }
              : {}),
            ...(propertyData.propertyName !== undefined
              ? { propertyName: normalizeRequiredText(propertyData.propertyName) }
              : {}),
            ...(propertyData.description !== undefined
              ? { description: normalizeText(propertyData.description) }
              : {}),
            ...(propertyData.status !== undefined
              ? { status: propertyData.status }
              : {}),
            ...(propertyData.workflowStatus !== undefined
              ? { workflowStatus: propertyData.workflowStatus }
              : {}),
            ...(propertyData.propertyAddress
              ? {
                  propertyAddress: {
                    upsert: {
                      create: propertyData.propertyAddress as any,
                      update: propertyData.propertyAddress as any,
                    },
                  },
                }
              : {}),
            ...(propertyData.propertyLocation
              ? {
                  propertyLocation: {
                    upsert: {
                      create: propertyData.propertyLocation as any,
                      update: propertyData.propertyLocation as any,
                    },
                  },
                }
              : {}),
            ...(propertyData.titleDocument
              ? {
                  titleDocument: {
                    upsert: {
                      create: {
                        ...(propertyData.titleDocument as any),
                        titleDeedType:
                          (propertyData.titleDocument as any).titleDeedType ??
                          existing.property?.titleDocument?.titleDeedType,
                      },
                      update: propertyData.titleDocument as any,
                    },
                  },
                }
              : {}),
            ...(propertyData.dataSource
              ? {
                  dataSource: {
                    upsert: {
                      create: {
                        ...(propertyData.dataSource as any),
                        sourceType:
                          (propertyData.dataSource as any).sourceType ??
                          existing.property?.dataSource?.sourceType ??
                          "OWNERSHIP",
                        createdBy: userId,
                        updateBy: userId,
                      },
                      update: {
                        ...(propertyData.dataSource as any),
                        updateBy: userId,
                      },
                    },
                  },
                }
              : {}),
            ...(propertyData.propertyPhotos
              ? {
                  propertyPhotos: {
                    upsert: {
                      create: {
                        frontSide: propertyData.propertyPhotos.frontSide ?? null,
                        inside: propertyData.propertyPhotos.inside ?? null,
                        leftSide: propertyData.propertyPhotos.leftSide ?? null,
                        rightSide: propertyData.propertyPhotos.rightSide ?? null,
                        opposite: propertyData.propertyPhotos.opposite ?? null,
                        gallery: normalizeGalleryJson(propertyData.propertyPhotos.gallery),
                      } as any,
                      update: {
                        ...(propertyData.propertyPhotos.frontSide !== undefined
                          ? { frontSide: propertyData.propertyPhotos.frontSide }
                          : {}),
                        ...(propertyData.propertyPhotos.inside !== undefined
                          ? { inside: propertyData.propertyPhotos.inside }
                          : {}),
                        ...(propertyData.propertyPhotos.leftSide !== undefined
                          ? { leftSide: propertyData.propertyPhotos.leftSide }
                          : {}),
                        ...(propertyData.propertyPhotos.rightSide !== undefined
                          ? { rightSide: propertyData.propertyPhotos.rightSide }
                          : {}),
                        ...(propertyData.propertyPhotos.opposite !== undefined
                          ? { opposite: propertyData.propertyPhotos.opposite }
                          : {}),
                        ...(propertyData.propertyPhotos.gallery !== undefined
                          ? { gallery: normalizeGalleryJson(propertyData.propertyPhotos.gallery) }
                          : {}),
                      },
                    },
                  },
                }
              : {}),
            updatedBy: userId,
          },
        });

        if (
          propertyData.propertyLocation?.latitude != null &&
          propertyData.propertyLocation?.longitude != null
        ) {
          await tx.$executeRaw`
            UPDATE property_locations
            SET geom = ST_SetSRID(
              ST_MakePoint(${Number(propertyData.propertyLocation.longitude)}, ${Number(
                propertyData.propertyLocation.latitude
              )}),
              4326
            )
            WHERE property_id = ${propertyId}
          `;
        }

        if (propertyData.propertyLocation?.polygon) {
          const normalizedPolygon =
            typeof propertyData.propertyLocation.polygon === "string"
              ? normalizePolygonData(propertyData.propertyLocation.polygon)
              : propertyData.propertyLocation.polygon;
          const wkt = convertGeoJsonToWKT(normalizedPolygon);

          if (wkt) {
            await tx.$executeRaw`
              UPDATE property_locations
              SET geom_polygon = ST_GeomFromText(${wkt}, 4326)
              WHERE property_id = ${propertyId}
            `;
          }
        }
      }

      let resolvedArea =
        dto.area !== undefined
          ? Number(dto.area)
          : primaryComponent?.area !== undefined
            ? Number(primaryComponent.area)
            : undefined;

      if (resolvedArea === undefined) {
        resolvedArea = await deriveComponentArea(tx, propertyId, componentType);
      }

      if (resolvedArea === undefined) {
        throw new BadRequestError(
          `Area could not be derived from property data for componentType '${componentType}'. Please provide 'area' explicitly.`
        );
      }

      const minRate =
        dto.minRate !== undefined
          ? Number(dto.minRate)
          : primaryComponent?.minRate !== undefined
            ? Number(primaryComponent.minRate)
            : undefined;
      const maxRate =
        dto.maxRate !== undefined
          ? Number(dto.maxRate)
          : primaryComponent?.maxRate !== undefined
            ? Number(primaryComponent.maxRate)
            : undefined;

      if (minRate === undefined || maxRate === undefined) {
        throw new BadRequestError("minRate and maxRate are required");
      }

      const { minValue, maxValue } = computeValues(resolvedArea, minRate, maxRate);
      const indicationNo = resolveIndicationNo(dto);
      const resolvedForcedSalePercentInput =
        dto.forcedSalePercent !== undefined ? dto.forcedSalePercent : existing.forcedSalePercent;
      const forcedSalePercent = normalizeForcedSalePercent(resolvedForcedSalePercentInput);
      const resolvedAccessValueInput =
        dto.accessValue !== undefined ? dto.accessValue : existing.accessValue;
      const resolvedFeeRateInput = dto.feeRate !== undefined ? dto.feeRate : existing.feeRate;
      const resolvedDiscountInput = dto.discount !== undefined ? dto.discount : existing.discount;
      const feeRate = normalizeFeePercent(resolvedFeeRateInput);
      const discount = normalizeFeePercent(resolvedDiscountInput);
      const accessValueRange = resolveFeeAccessValueRange({
        accessValue: resolvedAccessValueInput,
        fallbackMinAccessValue: minValue,
        fallbackMaxAccessValue: maxValue,
        treatMaxMatchAsAuto: true,
      });
      const computedChargeFeeRange = computeChargeFeeRange({
        accessValue: resolvedAccessValueInput,
        fallbackMinAccessValue: minValue,
        fallbackMaxAccessValue: maxValue,
        feeRate: resolvedFeeRateInput,
        discount: resolvedDiscountInput,
        treatMaxMatchAsAuto: true,
      });
      const computedChargeFee = computeChargeFee({
        accessValue: resolvedAccessValueInput,
        fallbackAccessValue: maxValue,
        feeRate: resolvedFeeRateInput,
        discount: resolvedDiscountInput,
      });

      await tx.propertyIndicativeValuation.update({
        where: { indicationId },
        data: {
          ...(dto.propertyId !== undefined
            ? { property: { connect: { propertyId: dto.propertyId } } }
            : {}),
          ...(indicationNo !== undefined ? { indicationNo } : {}),
          ...(dto.currency !== undefined
            ? { currency: normalizeText(dto.currency)?.toUpperCase() ?? "USD" }
            : {}),
          ...(resolveInstructedBy(dto) !== undefined
            ? { instructedBy: resolveInstructedBy(dto) }
            : {}),
          ...(dto.contactName !== undefined
            ? { contactName: normalizeText(dto.contactName) }
            : {}),
          ...(dto.contactTel !== undefined
            ? { contactTel: normalizeText(dto.contactTel) }
            : {}),
          ...(dto.accessValue !== undefined
            ? { accessValue: dto.accessValue != null ? new Decimal(dto.accessValue) : null }
            : {}),
          minAccessValue: accessValueRange.min,
          maxAccessValue: accessValueRange.max,
          ...(dto.feeRate !== undefined
            ? { feeRate: dto.feeRate != null ? new Decimal(feeRate) : null }
            : {}),
          ...(dto.discount !== undefined
            ? { discount: dto.discount != null ? new Decimal(discount) : null }
            : {}),
          ...(dto.chargeFee !== undefined
            ? {
                chargeFee:
                  computedChargeFee ??
                  (dto.chargeFee != null ? new Decimal(dto.chargeFee) : null),
              }
            : computedChargeFee !== null
              ? { chargeFee: computedChargeFee }
              : {}
          ),
          ...(dto.chargeFee === undefined &&
          computedChargeFee === null &&
          shouldAutoComputeChargeFee({
            accessValue: resolvedAccessValueInput,
            feeRate: resolvedFeeRateInput,
            discount: resolvedDiscountInput,
          })
            ? { chargeFee: null }
            : {}),
          minChargeFee:
            computedChargeFeeRange.min ??
            (dto.chargeFee !== undefined
              ? dto.chargeFee != null
                ? new Decimal(dto.chargeFee)
                : null
              : (existing as any).minChargeFee ?? existing.chargeFee ?? null),
          maxChargeFee:
            computedChargeFeeRange.max ??
            (dto.chargeFee !== undefined
              ? dto.chargeFee != null
                ? new Decimal(dto.chargeFee)
                : null
              : (existing as any).maxChargeFee ?? existing.chargeFee ?? null),
          ...(dto.valuerId !== undefined
            ? { valuer: { connect: { id: dto.valuerId } } }
            : {}),
          ...(dto.inspectorName !== undefined
            ? { inspectorName: normalizeText(dto.inspectorName) }
            : {}),
          ...(resolveInstructionDate(dto) !== undefined
            ? { instructionDate: resolveInstructionDate(dto) }
            : {}),
          ...(resolveIndicationDate(dto) !== undefined
            ? { indicationDate: resolveIndicationDate(dto) }
            : {}),
          ...(resolveIntendedUse(dto) !== undefined
            ? { intendedUse: resolveIntendedUse(dto) }
            : {}),
          ...(dto.forcedSalePercent !== undefined
            ? {
                forcedSalePercent:
                  dto.forcedSalePercent != null ? new Decimal(forcedSalePercent) : null,
              }
            : {}),
          ...(dto.note !== undefined ? { note: normalizeText(dto.note) } : {}),
          ...(dto.internalNotes !== undefined
            ? { internalNotes: normalizeText(dto.internalNotes) }
            : {}),
          ...(requestedStatus !== undefined ? { status: requestedStatus } : {}),
          ...(requestedWorkflowStatus !== undefined
            ? {
                workflowStatus: requestedWorkflowStatus,
                ...(requestedWorkflowStatus !== WorkflowStatus.REJECTED
                  ? {
                      rejectionReason: null,
                      rejectedUser: { disconnect: true },
                    }
                  : {}),
              }
            : existing.workflowStatus === WorkflowStatus.REJECTED
              ? {
                  workflowStatus: WorkflowStatus.DRAFT,
                  rejectionReason: null,
                  rejectedUser: { disconnect: true },
                }
              : {}),
          updatedByUser: { connect: { id: userId } },
        } as any,
        select: { indicationId: true },
      });

      if (primaryComponent) {
        await tx.indicativeValuationComponent.update({
          where: { id: primaryComponent.id },
          data: {
            componentType,
            description:
              normalizeText(dto.description) ??
              primaryComponent.description ??
              getComponentLabel(componentType),
            area: new Decimal(resolvedArea),
            minRate: new Decimal(minRate),
            maxRate: new Decimal(maxRate),
            minValue,
            maxValue,
          },
        });
      } else {
        await tx.indicativeValuationComponent.create({
          data: {
            indicationId,
            sortOrder: 0,
            componentType,
            description: normalizeText(dto.description) ?? getComponentLabel(componentType),
            area: new Decimal(resolvedArea),
            minRate: new Decimal(minRate),
            maxRate: new Decimal(maxRate),
            minValue,
            maxValue,
          },
        });
      }

      await refreshTotals(tx, indicationId);
      await repository.auditLog(tx, {
        userId,
        action: "INDICATIVE_UPDATE_VALUATION",
        entityId: indicationId,
        details: {
          propertyId,
          componentType,
          area: resolvedArea,
          minRate,
          maxRate,
        } as any,
      });
    });

    await invalidatePropertyStatisticsCache();

    return {
      success: true,
      message: "Indicative valuation updated successfully",
      data: await getSerializedValuation(indicationId),
    };
  },

  async reassignIndicativeValuation(
    indicationId: number,
    newValuerId: number,
    actorId: number,
    userHierarchyLevel: number
  ) {
    if (userHierarchyLevel > 2) {
      throw new ForbiddenError("Only privileged users can reassign indicative valuations");
    }

    const valuation = await repository.findWithComponents(indicationId);

    if (!valuation) {
      throw new NotFoundError(`Indicative valuation ${indicationId} not found`);
    }

    if (
      valuation.workflowStatus === WorkflowStatus.ARCHIVED ||
      valuation.workflowStatus === WorkflowStatus.APPROVED
    ) {
      throw new BadRequestError(
        "Approved or archived indicative valuations cannot be reassigned"
      );
    }

    const targetValuer = await prisma.user.findUnique({
      where: { id: newValuerId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!targetValuer) {
      throw new NotFoundError("Selected valuer not found");
    }

    const isValuer = targetValuer.roles.some(
      (userRole) => userRole.role?.roleCode?.toUpperCase() === "VALUER"
    );

    if (!isValuer) {
      throw new BadRequestError("Selected user must have the VALUER role");
    }

    await prisma.$transaction(async (tx) => {
      await tx.propertyIndicativeValuation.update({
        where: { indicationId },
        data: {
          valuer: { connect: { id: newValuerId } },
          updatedByUser: { connect: { id: actorId } },
          internalNotes: valuation.internalNotes
            ? `${valuation.internalNotes}\n[System]: Reassigned to User ${newValuerId} by User ${actorId}`
            : `[System]: Reassigned to User ${newValuerId} by User ${actorId}`,
        },
        select: { indicationId: true },
      });

      await repository.auditLog(tx, {
        userId: actorId,
        action: "INDICATIVE_REASSIGN_VALUATION",
        entityId: indicationId,
        details: {
          previousValuerId: valuation.valuerId,
          newValuerId,
        },
      });
    });

    return {
      success: true,
      message: "Indicative valuation successfully reassigned",
      data: await getSerializedValuation(indicationId),
    };
  },

  async archiveIndicativeValuation(
    indicationId: number,
    actorId: number,
    userHierarchyLevel: number
  ) {
    if (userHierarchyLevel > 2) {
      throw new ForbiddenError("Only privileged users can archive indicative valuations");
    }

    const valuation = await repository.findWithComponents(indicationId);

    if (!valuation) {
      throw new NotFoundError(`Indicative valuation ${indicationId} not found`);
    }

    if (valuation.workflowStatus === WorkflowStatus.ARCHIVED) {
      throw new BadRequestError("Indicative valuation is already archived");
    }

    await prisma.$transaction(async (tx) => {
      await tx.propertyIndicativeValuation.update({
        where: { indicationId },
        data: {
          workflowStatus: WorkflowStatus.ARCHIVED,
          status: PropertyIndicativeValuationStatus.CANCELLED,
          updatedByUser: { connect: { id: actorId } },
        },
        select: { indicationId: true },
      });

      await repository.auditLog(tx, {
        userId: actorId,
        action: "INDICATIVE_ARCHIVE_VALUATION",
        entityId: indicationId,
        details: {
          workflowStatus: WorkflowStatus.ARCHIVED,
          status: PropertyIndicativeValuationStatus.CANCELLED,
        },
      });
    });

    await invalidatePropertyStatisticsCache();

    return {
      success: true,
      message: "Indicative valuation archived successfully",
      data: null,
    };
  },

  async getComponentById(indicationId: number, id: number) {
    await assertValuationExists(indicationId);
    const component = await repository.findById(id);

    if (!component || component.indicationId !== indicationId) {
      throw new NotFoundError(`Component ${id} not found`);
    }

    return serializeComponent(component);
  },

  async createComponent(indicationId: number, dto: CreateIndicativeComponentDTO) {
    const valuation = await assertValuationExists(indicationId);
    const componentType = dto.componentType ?? IndicativeComponentType.LAND;
    let resolvedArea = dto.area;

    if (resolvedArea === undefined) {
      resolvedArea = await deriveComponentArea(prisma, valuation.propertyId, componentType);
    }

    if (resolvedArea === undefined) {
      throw new BadRequestError(
        `Area could not be derived for componentType '${componentType}'. Please provide 'area' explicitly.`
      );
    }

    const { minValue, maxValue } = computeValues(
      resolvedArea,
      dto.minRate,
      dto.maxRate
    );

    const component = await prisma.$transaction(async (tx) => {
      const currentCount = await tx.indicativeValuationComponent.count({
        where: { indicationId },
      });

      const created = await tx.indicativeValuationComponent.create({
        data: {
          indication: { connect: { indicationId } },
          sortOrder: currentCount,
          componentType,
          description: normalizeText(dto.description) ?? getComponentLabel(componentType),
          area: new Decimal(resolvedArea),
          minRate: new Decimal(dto.minRate),
          maxRate: new Decimal(dto.maxRate),
          minValue,
          maxValue,
        },
      });

      await refreshTotals(tx, indicationId);
      return created;
    });

    return serializeComponent(component);
  },

  async updateComponent(
    indicationId: number,
    id: number,
    dto: UpdateIndicativeComponentDTO
  ) {
    const existing = await repository.findById(id);

    if (!existing || existing.indicationId !== indicationId) {
      throw new NotFoundError(`Component ${id} not found`);
    }

    const componentType =
      dto.componentType ??
      (existing.componentType as IndicativeComponentType | undefined) ??
      IndicativeComponentType.LAND;
    const area = dto.area !== undefined ? Number(dto.area) : Number(existing.area);
    const minRate =
      dto.minRate !== undefined ? Number(dto.minRate) : Number(existing.minRate);
    const maxRate =
      dto.maxRate !== undefined ? Number(dto.maxRate) : Number(existing.maxRate);
    const { minValue, maxValue } = computeValues(area, minRate, maxRate);
    const description =
      dto.description !== undefined
        ? normalizeText(dto.description)
        : existing.description ?? getComponentLabel(componentType);

    const component = await prisma.$transaction(async (tx) => {
      const updated = await tx.indicativeValuationComponent.update({
        where: { id },
        data: {
          ...(dto.componentType !== undefined ? { componentType: dto.componentType } : {}),
          description,
          area: new Decimal(area),
          minRate: new Decimal(minRate),
          maxRate: new Decimal(maxRate),
          minValue,
          maxValue,
        },
      });

      await refreshTotals(tx, indicationId);
      return updated;
    });

    return serializeComponent(component);
  },

  async deleteComponent(indicationId: number, id: number) {
    const existing = await repository.findById(id);

    if (!existing || existing.indicationId !== indicationId) {
      throw new NotFoundError(`Component ${id} not found`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.indicativeValuationComponent.delete({ where: { id } });
      await refreshTotals(tx, indicationId);
    });

  },
};
