import ExcelJS from "exceljs";
import {
  Prisma,
  PropertyValuationStatus,
  ValuationMethod,
  WorkflowStatus,
} from "@prisma/client";
import { prisma } from "../../db/prisma";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { invalidatePropertyStatisticsCache } from "../../services/cache/propertyStatisticsCache";

export type PropertyValuationExcelExportFilters = {
  status?: PropertyValuationStatus;
  workflowStatus?: WorkflowStatus;
  valuationMethod?: ValuationMethod;
  valuerId?: number;
  propertyId?: number;
  propertyTypeId?: number;
  preparedFor?: string;
  purposeOfValuation?: string;
  provinceId?: string;
  districtId?: string;
  communeId?: string;
  villageId?: string;
  valuationDateFrom?: Date;
  valuationDateTo?: Date;
  minValue?: number;
  maxValue?: number;
  search?: string;
};

export type PropertyValuationImportSummary = {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

const normalizeHeader = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const cellPrimitive = (cell: ExcelJS.Cell): unknown => {
  const value = cell.value;
  if (value === null || value === undefined) return undefined;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }

  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return value.result;
    if ("text" in value && typeof value.text === "string") return value.text;
  }

  const text = cell.text?.trim();
  return text ? text : undefined;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
};

const toOptionalNumber = (
  value: unknown,
  fieldName: string,
  opts: { integer?: boolean; min?: number } = {},
): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new BadRequestError(`${fieldName} must be a valid number`);
  }
  if (opts.integer && !Number.isInteger(num)) {
    throw new BadRequestError(`${fieldName} must be an integer`);
  }
  if (opts.min !== undefined && num < opts.min) {
    throw new BadRequestError(`${fieldName} must be greater than or equal to ${opts.min}`);
  }
  return num;
};

const excelSerialToDate = (serial: number): Date => {
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const msPerDay = 24 * 60 * 60 * 1000;
  return new Date(epoch.getTime() + serial * msPerDay);
};

const toOptionalDate = (value: unknown, fieldName: string): Date | undefined => {
  if (value === null || value === undefined || value === "") return undefined;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestError(`${fieldName} must be a valid date`);
    }
    return value;
  }

  if (typeof value === "number") {
    const asDate = excelSerialToDate(value);
    if (Number.isNaN(asDate.getTime())) {
      throw new BadRequestError(`${fieldName} must be a valid date`);
    }
    return asDate;
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date`);
  }
  return parsed;
};

const parseEnum = <T extends string>(
  value: unknown,
  enumObject: Record<string, T>,
  fieldName: string,
): T | undefined => {
  const raw = toOptionalString(value);
  if (!raw) return undefined;

  const normalized = raw.toUpperCase().replace(/[\s-]+/g, "_");
  const enumValues = Object.values(enumObject) as string[];
  const match = enumValues.find((v) => v.toUpperCase() === normalized);

  if (!match) {
    throw new BadRequestError(
      `${fieldName} must be one of: ${enumValues.join(", ")}`,
    );
  }

  return match as T;
};

const hasValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
};

const rowHasData = (row: ExcelJS.Row): boolean => {
  let found = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (hasValue(cellPrimitive(cell))) {
      found = true;
    }
  });
  return found;
};

const buildHeaderMap = (worksheet: ExcelJS.Worksheet): Map<string, number> => {
  const map = new Map<string, number>();
  const headerRow = worksheet.getRow(1);

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const raw = toOptionalString(cellPrimitive(cell));
    if (!raw) return;
    map.set(normalizeHeader(raw), colNumber);
  });

  return map;
};

const valueFromAliases = (
  row: ExcelJS.Row,
  headerMap: Map<string, number>,
  aliases: string[],
): unknown => {
  for (const alias of aliases) {
    const col = headerMap.get(normalizeHeader(alias));
    if (!col) continue;
    const value = cellPrimitive(row.getCell(col));
    if (value !== undefined && value !== null && `${value}`.trim() !== "") {
      return value;
    }
  }
  return undefined;
};

export const exportPropertyValuationsToExcel = async (
  filters: PropertyValuationExcelExportFilters = {},
): Promise<Uint8Array> => {
  const conditions: Prisma.PropertyValuationWhereInput[] = [];

  if (filters.search?.trim()) {
    conditions.push({
      OR: [
        {
          valuationNo: {
            contains: filters.search,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          property: {
            is: {
              OR: [
                {
                  propertyCode: {
                    contains: filters.search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  propertyName: {
                    contains: filters.search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  dataSource: {
                    is: {
                      contactName: {
                        contains: filters.search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                  },
                },
                {
                  dataSource: {
                    is: {
                      phoneNumber: {
                        contains: filters.search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                  },
                },
              ],
            },
          },
        },
        {
          valuer: {
            username: {
              contains: filters.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
        {
          valuer: {
            firstName: {
              contains: filters.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
        {
          valuer: {
            lastName: {
              contains: filters.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
      ],
    });
  }

  if (filters.propertyId) conditions.push({ propertyId: filters.propertyId });
  if (filters.valuerId) conditions.push({ valuerId: filters.valuerId });
  if (filters.status) conditions.push({ status: filters.status });
  if (filters.valuationMethod) {
    conditions.push({ valuationMethod: filters.valuationMethod });
  }
  if (filters.preparedFor?.trim()) {
    conditions.push({ preparedFor: filters.preparedFor.trim() });
  }
  if (filters.purposeOfValuation?.trim()) {
    conditions.push({ purposeOfValuation: filters.purposeOfValuation.trim() });
  }
  if (filters.propertyTypeId) {
    conditions.push({
      property: {
        is: {
          propertyTypeId: filters.propertyTypeId,
        },
      },
    });
  }
  if (
    filters.provinceId ||
    filters.districtId ||
    filters.communeId ||
    filters.villageId
  ) {
    conditions.push({
      property: {
        is: {
          propertyAddress: {
            is: {
              ...(filters.provinceId ? { provinceId: filters.provinceId } : {}),
              ...(filters.districtId ? { districtId: filters.districtId } : {}),
              ...(filters.communeId ? { communeId: filters.communeId } : {}),
              ...(filters.villageId ? { villageId: filters.villageId } : {}),
            },
          },
        },
      },
    });
  }
  if (filters.minValue !== undefined || filters.maxValue !== undefined) {
    conditions.push({
      marketValue: {
        ...(filters.minValue !== undefined ? { gte: filters.minValue } : {}),
        ...(filters.maxValue !== undefined ? { lte: filters.maxValue } : {}),
      },
    });
  }
  if (filters.valuationDateFrom || filters.valuationDateTo) {
    conditions.push({
      valuationDate: {
        ...(filters.valuationDateFrom ? { gte: filters.valuationDateFrom } : {}),
        ...(filters.valuationDateTo ? { lte: filters.valuationDateTo } : {}),
      },
    });
  }

  if (filters.workflowStatus) {
    conditions.push({ workflowStatus: filters.workflowStatus });
  } else {
    conditions.push({ workflowStatus: { not: WorkflowStatus.ARCHIVED } });
  }

  const where: Prisma.PropertyValuationWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const valuations = await prisma.propertyValuation.findMany({
    where,
    orderBy: { valuationId: "asc" },
    include: {
      property: {
        include: {
          propertyType: true,
          propertyAddress: {
            include: {
              province: true,
              district: true,
              commune: true,
              village: true,
            },
          },
          titleDocument: true,
        },
      },
      valuer: {
        select: { id: true, username: true, firstName: true, lastName: true },
      },
    },
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("property-valuations");

  worksheet.columns = [
    { header: "valuationNo", key: "valuationNo", width: 24 },
    { header: "propertyName", key: "propertyName", width: 28 },
    { header: "propertyTypeName", key: "propertyTypeName", width: 20 },
    { header: "valuationMethod", key: "valuationMethod", width: 30 },
    { header: "status", key: "status", width: 14 },
    { header: "workflowStatus", key: "workflowStatus", width: 18 },
    { header: "valuationDate", key: "valuationDate", width: 18 },
    { header: "dateOfInspection", key: "dateOfInspection", width: 18 },
    { header: "dateOfReport", key: "dateOfReport", width: 18 },
    { header: "marketValue", key: "marketValue", width: 16 },
    { header: "landValue", key: "landValue", width: 16 },
    { header: "buildingValue", key: "buildingValue", width: 16 },
    { header: "forcedSaleValue", key: "forcedSaleValue", width: 18 },
    { header: "pricePerSqm", key: "pricePerSqm", width: 14 },
    { header: "currency", key: "currency", width: 10 },
    { header: "preparedFor", key: "preparedFor", width: 24 },
    { header: "valuerName", key: "valuerName", width: 24 },
    { header: "purposeOfValuation", key: "purposeOfValuation", width: 28 },
    { header: "provinceNameEn", key: "provinceNameEn", width: 20 },
    { header: "districtNameEn", key: "districtNameEn", width: 20 },
    { header: "communeNameEn", key: "communeNameEn", width: 20 },
    { header: "villageNameEn", key: "villageNameEn", width: 20 },
    { header: "titleDeedType", key: "titleDeedType", width: 16 },
    { header: "titleDeedNo", key: "titleDeedNo", width: 18 },
    { header: "totalSizeByTitleDeed", key: "totalSizeByTitleDeed", width: 20 },
  ];

  for (const valuation of valuations) {
    const valuerName = valuation.valuer
      ? `${valuation.valuer.firstName ?? ""} ${valuation.valuer.lastName ?? ""}`.trim() ||
        valuation.valuer.username
      : "";
    const titleDoc = valuation.property.titleDocument;

    worksheet.addRow({
      valuationNo: valuation.valuationNo,
      propertyName: valuation.property.propertyName,
      propertyTypeName: valuation.property.propertyType.propertyName,
      valuationMethod: valuation.valuationMethod,
      status: valuation.status,
      workflowStatus: valuation.workflowStatus,
      valuationDate: valuation.valuationDate,
      dateOfInspection: valuation.dateOfInspection ?? "",
      dateOfReport: valuation.dateOfReport ?? "",
      marketValue:
        valuation.marketValue !== null && valuation.marketValue !== undefined
          ? Number(valuation.marketValue)
          : "",
      landValue:
        valuation.landValue !== null && valuation.landValue !== undefined
          ? Number(valuation.landValue)
          : "",
      buildingValue:
        valuation.buildingValue !== null && valuation.buildingValue !== undefined
          ? Number(valuation.buildingValue)
          : "",
      forcedSaleValue:
        valuation.forcedSaleValue !== null && valuation.forcedSaleValue !== undefined
          ? Number(valuation.forcedSaleValue)
          : "",
      pricePerSqm:
        valuation.pricePerSqm !== null && valuation.pricePerSqm !== undefined
          ? Number(valuation.pricePerSqm)
          : "",
      currency: valuation.currency,
      preparedFor: valuation.preparedFor ?? "",
      valuerName,
      purposeOfValuation: valuation.purposeOfValuation ?? "",
      provinceNameEn: valuation.property.propertyAddress?.province?.nameEn ?? "",
      districtNameEn: valuation.property.propertyAddress?.district?.nameEn ?? "",
      communeNameEn: valuation.property.propertyAddress?.commune?.nameEn ?? "",
      villageNameEn: valuation.property.propertyAddress?.village?.nameEn ?? "",
      titleDeedType: titleDoc?.titleDeedType ?? "",
      titleDeedNo: titleDoc?.titleDeedNo ?? "",
      totalSizeByTitleDeed:
        titleDoc?.totalSizeByTitleDeed !== null &&
        titleDoc?.totalSizeByTitleDeed !== undefined
          ? Number(titleDoc.totalSizeByTitleDeed)
          : "",
    });
  }

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
};

export const importPropertyValuationsFromExcel = async (
  file: Express.Multer.File,
  actorUserId?: number,
): Promise<PropertyValuationImportSummary> => {
  if (!file?.buffer) {
    throw new BadRequestError("excelFile is required");
  }

  const workbook = new ExcelJS.Workbook();
  await (workbook.xlsx as any).load(file.buffer);

  const worksheet =
    workbook.getWorksheet("property-valuations") ??
    workbook.getWorksheet("property_valuations") ??
    workbook.worksheets[0];

  if (!worksheet) {
    throw new BadRequestError("Excel workbook must contain at least one worksheet");
  }

  const headerMap = buildHeaderMap(worksheet);
  if (headerMap.size === 0) {
    throw new BadRequestError("Header row is missing in Excel sheet");
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  let totalRows = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (!rowHasData(row)) continue;

    totalRows += 1;

    try {
      const valuationId = toOptionalNumber(
        valueFromAliases(row, headerMap, ["valuationId", "valuation_id", "id"]),
        "valuationId",
        { integer: true, min: 1 },
      );
      const valuationNo = toOptionalString(
        valueFromAliases(row, headerMap, ["valuationNo", "valuation_no"]),
      );

      const propertyId = toOptionalNumber(
        valueFromAliases(row, headerMap, ["propertyId", "property_id"]),
        "propertyId",
        { integer: true, min: 1 },
      );
      const propertyCode = toOptionalString(
        valueFromAliases(row, headerMap, ["propertyCode", "property_code"]),
      );

      const valuationMethod = parseEnum(
        valueFromAliases(row, headerMap, ["valuationMethod", "valuation_method"]),
        ValuationMethod,
        "valuationMethod",
      );
      const status = parseEnum(
        valueFromAliases(row, headerMap, ["status"]),
        PropertyValuationStatus,
        "status",
      );
      const workflowStatus = parseEnum(
        valueFromAliases(row, headerMap, ["workflowStatus", "workflow_status"]),
        WorkflowStatus,
        "workflowStatus",
      );

      const valuationDate = toOptionalDate(
        valueFromAliases(row, headerMap, ["valuationDate", "valuation_date"]),
        "valuationDate",
      );
      const dateOfInspection = toOptionalDate(
        valueFromAliases(row, headerMap, ["dateOfInspection", "date_of_inspection"]),
        "dateOfInspection",
      );
      const dateOfReport = toOptionalDate(
        valueFromAliases(row, headerMap, ["dateOfReport", "date_of_report"]),
        "dateOfReport",
      );

      const marketValue = toOptionalNumber(
        valueFromAliases(row, headerMap, ["marketValue", "market_value"]),
        "marketValue",
        { min: 0 },
      );
      const landValue = toOptionalNumber(
        valueFromAliases(row, headerMap, ["landValue", "land_value"]),
        "landValue",
        { min: 0 },
      );
      const buildingValue = toOptionalNumber(
        valueFromAliases(row, headerMap, ["buildingValue", "building_value"]),
        "buildingValue",
        { min: 0 },
      );
      const forcedSaleValue = toOptionalNumber(
        valueFromAliases(row, headerMap, ["forcedSaleValue", "forced_sale_value"]),
        "forcedSaleValue",
        { min: 0 },
      );
      const pricePerSqm = toOptionalNumber(
        valueFromAliases(row, headerMap, ["pricePerSqm", "price_per_sqm"]),
        "pricePerSqm",
        { min: 0 },
      );

      const currency = toOptionalString(
        valueFromAliases(row, headerMap, ["currency"]),
      );
      const preparedFor = toOptionalString(
        valueFromAliases(row, headerMap, ["preparedFor", "prepared_for"]),
      );
      const valuerId = toOptionalNumber(
        valueFromAliases(row, headerMap, ["valuerId", "valuer_id"]),
        "valuerId",
        { integer: true, min: 1 },
      );
      const inspectorName = toOptionalString(
        valueFromAliases(row, headerMap, ["inspectorName", "inspector_name"]),
      );
      const purposeOfValuation = toOptionalString(
        valueFromAliases(row, headerMap, ["purposeOfValuation", "purpose_of_valuation"]),
      );
      const note = toOptionalString(valueFromAliases(row, headerMap, ["note"]));
      const internalNotes = toOptionalString(
        valueFromAliases(row, headerMap, ["internalNotes", "internal_notes"]),
      );

      if (
        marketValue !== undefined &&
        forcedSaleValue !== undefined &&
        forcedSaleValue > marketValue
      ) {
        throw new BadRequestError("forcedSaleValue cannot exceed marketValue");
      }

      let existingValuation:
        | (Prisma.PropertyValuationGetPayload<{
            select: {
              valuationId: true;
              valuationNo: true;
              propertyId: true;
            };
          }>)
        | null = null;

      if (valuationId !== undefined) {
        existingValuation = await prisma.propertyValuation.findUnique({
          where: { valuationId },
          select: { valuationId: true, valuationNo: true, propertyId: true },
        });
        // If valuationId not found, fall through to try by valuationNo or create new
      }

      if (!existingValuation && valuationNo) {
        existingValuation = await prisma.propertyValuation.findUnique({
          where: { valuationNo },
          select: { valuationId: true, valuationNo: true, propertyId: true },
        });
      }

      if (!existingValuation && !valuationNo) {
        throw new BadRequestError(
          "valuationNo is required for new valuation rows",
        );
      }

      let resolvedPropertyId = propertyId ?? existingValuation?.propertyId;

      if (!resolvedPropertyId && propertyCode) {
        const property = await prisma.property.findUnique({
          where: { propertyCode },
          select: { propertyId: true },
        });

        if (!property) {
          throw new BadRequestError(`propertyCode ${propertyCode} was not found`);
        }

        resolvedPropertyId = property.propertyId;
      }

      if (resolvedPropertyId === undefined) {
        throw new BadRequestError("propertyId or propertyCode is required");
      }

      const propertyExists = await prisma.property.findUnique({
        where: { propertyId: resolvedPropertyId },
        select: { propertyId: true, propertyCode: true },
      });
      if (!propertyExists) {
        throw new BadRequestError(`propertyId ${resolvedPropertyId} was not found`);
      }

      if (propertyCode && propertyExists.propertyCode !== propertyCode) {
        throw new BadRequestError(
          `propertyCode ${propertyCode} does not match propertyId ${resolvedPropertyId}`,
        );
      }

      if (currency && currency.length !== 3) {
        throw new BadRequestError("currency must be a 3-letter code (e.g. USD)");
      }

      if (existingValuation) {
        await prisma.propertyValuation.update({
          where: { valuationId: existingValuation.valuationId },
          data: {
            ...(valuationNo !== undefined ? { valuationNo } : {}),
            propertyId: resolvedPropertyId,
            ...(valuationMethod !== undefined ? { valuationMethod } : {}),
            ...(status !== undefined ? { status } : {}),
            ...(workflowStatus !== undefined ? { workflowStatus } : {}),
            ...(valuationDate !== undefined ? { valuationDate } : {}),
            ...(dateOfInspection !== undefined ? { dateOfInspection } : {}),
            ...(dateOfReport !== undefined ? { dateOfReport } : {}),
            ...(marketValue !== undefined ? { marketValue } : {}),
            ...(landValue !== undefined ? { landValue } : {}),
            ...(buildingValue !== undefined ? { buildingValue } : {}),
            ...(forcedSaleValue !== undefined ? { forcedSaleValue } : {}),
            ...(pricePerSqm !== undefined ? { pricePerSqm } : {}),
            ...(currency !== undefined ? { currency: currency.toUpperCase() } : {}),
            ...(preparedFor !== undefined ? { preparedFor } : {}),
            ...(valuerId !== undefined ? { valuerId } : {}),
            ...(inspectorName !== undefined ? { inspectorName } : {}),
            ...(purposeOfValuation !== undefined ? { purposeOfValuation } : {}),
            ...(note !== undefined ? { note } : {}),
            ...(internalNotes !== undefined ? { internalNotes } : {}),
            ...(actorUserId ? { updatedBy: actorUserId } : {}),
          },
        });

        updated += 1;
      } else {
        await prisma.propertyValuation.create({
          data: {
            valuationNo: valuationNo as string,
            propertyId: resolvedPropertyId,
            valuationMethod:
              valuationMethod ?? ValuationMethod.SALES_COMPARISON_APPROACH,
            status: status ?? PropertyValuationStatus.ACTIVE,
            workflowStatus: workflowStatus ?? WorkflowStatus.DRAFT,
            valuationDate: valuationDate ?? new Date(),
            ...(dateOfInspection !== undefined ? { dateOfInspection } : {}),
            ...(dateOfReport !== undefined ? { dateOfReport } : {}),
            ...(marketValue !== undefined ? { marketValue } : {}),
            ...(landValue !== undefined ? { landValue } : {}),
            ...(buildingValue !== undefined ? { buildingValue } : {}),
            ...(forcedSaleValue !== undefined ? { forcedSaleValue } : {}),
            ...(pricePerSqm !== undefined ? { pricePerSqm } : {}),
            currency: (currency ?? "USD").toUpperCase(),
            ...(preparedFor !== undefined ? { preparedFor } : {}),
            ...(valuerId !== undefined
              ? { valuerId }
              : actorUserId
                ? { valuerId: actorUserId }
                : {}),
            ...(inspectorName !== undefined ? { inspectorName } : {}),
            ...(purposeOfValuation !== undefined ? { purposeOfValuation } : {}),
            ...(note !== undefined ? { note } : {}),
            ...(internalNotes !== undefined ? { internalNotes } : {}),
            ...(actorUserId
              ? { createdBy: actorUserId, updatedBy: actorUserId }
              : {}),
          },
        });

        created += 1;
      }
    } catch (error) {
      failed += 1;
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : "Unknown import error",
      });
    }
  }

  if (created > 0 || updated > 0) {
    await invalidatePropertyStatisticsCache();
  }

  return {
    totalRows,
    created,
    updated,
    failed,
    errors,
  };
};
