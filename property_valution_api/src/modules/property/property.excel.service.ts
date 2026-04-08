import ExcelJS from "exceljs";
import {
  Prisma,
  PropertyStatus,
  TitleTypeEnum,
  TransactionType,
  WorkflowStatus,
} from "@prisma/client";
import { prisma } from "../../db/prisma";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { createPropertyCodeService } from "../../services/property/propertyCode.service";
import { invalidatePropertyStatisticsCache } from "../../services/cache/propertyStatisticsCache";

export type PropertyExcelExportFilters = {
  status?: PropertyStatus;
  workflowStatus?: WorkflowStatus;
  propertyTypeId?: number;
  provinceId?: string;
  districtId?: string;
  communeId?: string;
  villageId?: string;
  minPrice?: number;
  maxPrice?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  createdById?: number;
  search?: string;
};

export type ExcelImportRowError = {
  row: number;
  message: string;
};

export type PropertyImportSummary = {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  errors: ExcelImportRowError[];
};

const propertyCodeService = createPropertyCodeService(prisma as any);

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
    const v = cellPrimitive(cell);
    if (hasValue(v)) found = true;
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

const getPropertyTypeName = async (propertyTypeId: number): Promise<string> => {
  const propertyType = await prisma.propertyType.findUnique({
    where: { propertyTypeId },
    select: { propertyName: true },
  });
  if (!propertyType) {
    throw new BadRequestError(`propertyTypeId ${propertyTypeId} does not exist`);
  }
  return propertyType.propertyName;
};

export const exportPropertiesToExcel = async (
  filters: PropertyExcelExportFilters = {},
): Promise<Uint8Array> => {
  const conditions: Prisma.PropertyWhereInput[] = [];

  if (filters.status) conditions.push({ status: filters.status });
  if (filters.propertyTypeId) {
    conditions.push({ propertyTypeId: filters.propertyTypeId });
  }
  if (filters.search?.trim()) {
    conditions.push({
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
          description: {
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
    });
  }
  if (
    filters.provinceId ||
    filters.districtId ||
    filters.communeId ||
    filters.villageId
  ) {
    conditions.push({
      propertyAddress: {
        is: {
          ...(filters.provinceId ? { provinceId: filters.provinceId } : {}),
          ...(filters.districtId ? { districtId: filters.districtId } : {}),
          ...(filters.communeId ? { communeId: filters.communeId } : {}),
          ...(filters.villageId ? { villageId: filters.villageId } : {}),
        },
      },
    });
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    conditions.push({
      transaction: {
        some: {
          totalPrice: {
            ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
          },
        },
      },
    });
  }
  if (filters.createdAfter || filters.createdBefore) {
    conditions.push({
      createdAt: {
        ...(filters.createdAfter ? { gte: filters.createdAfter } : {}),
        ...(filters.createdBefore ? { lte: filters.createdBefore } : {}),
      },
    });
  }
  if (filters.createdById) {
    conditions.push({ createdBy: filters.createdById });
  }

  if (filters.workflowStatus) {
    conditions.push({ workflowStatus: filters.workflowStatus });
  } else {
    conditions.push({ workflowStatus: { not: WorkflowStatus.ARCHIVED } });
  }

  const where: Prisma.PropertyWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const properties = await prisma.property.findMany({
    where,
    orderBy: { propertyId: "asc" },
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
      propertyLocation: true,
      propertyPhotos: true,
      titleDocument: true,
      transaction: {
        orderBy: { transactionDate: "desc" },
        take: 1,
      },
    },
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("properties");

  worksheet.columns = [
    { header: "propertyId", key: "propertyId", width: 12 },
    { header: "propertyCode", key: "propertyCode", width: 22 },
    { header: "propertyName", key: "propertyName", width: 28 },
    { header: "propertyTypeName", key: "propertyTypeName", width: 20 },
    { header: "status", key: "status", width: 14 },
    { header: "workflowStatus", key: "workflowStatus", width: 18 },
    { header: "provinceNameEn", key: "provinceNameEn", width: 20 },
    { header: "districtNameEn", key: "districtNameEn", width: 20 },
    { header: "communeNameEn", key: "communeNameEn", width: 20 },
    { header: "villageNameEn", key: "villageNameEn", width: 20 },
    { header: "titleDeedType", key: "titleDeedType", width: 16 },
    { header: "titleDeedNo", key: "titleDeedNo", width: 18 },
    { header: "totalSizeByTitleDeed", key: "totalSizeByTitleDeed", width: 20 },
    { header: "latitude", key: "latitude", width: 14 },
    { header: "longitude", key: "longitude", width: 14 },
    { header: "transactionType", key: "transactionType", width: 18 },
    { header: "transactionDate", key: "transactionDate", width: 18 },
    { header: "totalPrice", key: "totalPrice", width: 16 },
  ];

  for (const property of properties) {
    const latestTransaction = property.transaction[0];
    const titleDoc = property.titleDocument;

    worksheet.addRow({
      propertyId: property.propertyId,
      propertyCode: property.propertyCode,
      propertyName: property.propertyName,
      propertyTypeName: property.propertyType.propertyName,
      status: property.status,
      workflowStatus: property.workflowStatus,
      provinceNameEn: property.propertyAddress?.province?.nameEn ?? "",
      districtNameEn: property.propertyAddress?.district?.nameEn ?? "",
      communeNameEn: property.propertyAddress?.commune?.nameEn ?? "",
      villageNameEn: property.propertyAddress?.village?.nameEn ?? "",
      titleDeedType: titleDoc?.titleDeedType ?? "",
      titleDeedNo: titleDoc?.titleDeedNo ?? "",
      totalSizeByTitleDeed:
        titleDoc?.totalSizeByTitleDeed !== null &&
        titleDoc?.totalSizeByTitleDeed !== undefined
          ? Number(titleDoc.totalSizeByTitleDeed)
          : "",
      latitude:
        property.propertyLocation?.latitude !== null &&
        property.propertyLocation?.latitude !== undefined
          ? Number(property.propertyLocation.latitude)
          : "",
      longitude:
        property.propertyLocation?.longitude !== null &&
        property.propertyLocation?.longitude !== undefined
          ? Number(property.propertyLocation.longitude)
          : "",
      transactionType: latestTransaction?.transactionType ?? "",
      transactionDate: latestTransaction?.transactionDate ?? "",
      totalPrice:
        latestTransaction?.totalPrice !== undefined && latestTransaction?.totalPrice !== null
          ? Number(latestTransaction.totalPrice)
          : "",
    });
  }

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
};

export const importPropertiesFromExcel = async (
  file: Express.Multer.File,
  actorUserId?: number,
): Promise<PropertyImportSummary> => {
  if (!file?.buffer) {
    throw new BadRequestError("excelFile is required");
  }

  const workbook = new ExcelJS.Workbook();
  await (workbook.xlsx as any).load(file.buffer);

  const worksheet = workbook.getWorksheet("properties") ?? workbook.worksheets[0];
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
  const errors: ExcelImportRowError[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (!rowHasData(row)) continue;

    totalRows += 1;

    try {
      const propertyId = toOptionalNumber(
        valueFromAliases(row, headerMap, ["propertyId", "property_id", "id"]),
        "propertyId",
        { integer: true, min: 1 },
      );

      const rawPropertyCode = toOptionalString(
        valueFromAliases(row, headerMap, ["propertyCode", "property_code", "code"]),
      );
      const propertyName = toOptionalString(
        valueFromAliases(row, headerMap, ["propertyName", "property_name", "name"]),
      );

      const propertyTypeId = toOptionalNumber(
        valueFromAliases(row, headerMap, ["propertyTypeId", "property_type_id"]),
        "propertyTypeId",
        { integer: true, min: 1 },
      );
      const propertySubtypeId = toOptionalNumber(
        valueFromAliases(row, headerMap, ["propertySubtypeId", "property_subtype_id"]),
        "propertySubtypeId",
        { integer: true, min: 1 },
      );
      const currentUseId = toOptionalNumber(
        valueFromAliases(row, headerMap, ["currentUseId", "current_use_id"]),
        "currentUseId",
        { integer: true, min: 1 },
      );

      const status = parseEnum(
        valueFromAliases(row, headerMap, ["status"]),
        PropertyStatus,
        "status",
      );
      const workflowStatus = parseEnum(
        valueFromAliases(row, headerMap, ["workflowStatus", "workflow_status"]),
        WorkflowStatus,
        "workflowStatus",
      );

      const description = toOptionalString(
        valueFromAliases(row, headerMap, ["description"]),
      );

      const provinceId = toOptionalString(
        valueFromAliases(row, headerMap, ["provinceId", "province_id"]),
      );
      const districtId = toOptionalString(
        valueFromAliases(row, headerMap, ["districtId", "district_id"]),
      );
      const communeId = toOptionalString(
        valueFromAliases(row, headerMap, ["communeId", "commune_id"]),
      );
      const villageId = toOptionalString(
        valueFromAliases(row, headerMap, ["villageId", "village_id"]),
      );
      const street = toOptionalString(
        valueFromAliases(row, headerMap, ["street"]),
      );
      const houseNo = toOptionalString(
        valueFromAliases(row, headerMap, ["houseNo", "house_no"]),
      );
      const frontSide = toOptionalString(
        valueFromAliases(row, headerMap, ["frontSide", "front_side"]),
      );
      const inside = toOptionalString(
        valueFromAliases(row, headerMap, ["inside"]),
      );
      const accessRoads = toOptionalString(
        valueFromAliases(row, headerMap, ["accessRoads", "access_roads"]),
      );
      const neighborLocation = toOptionalString(
        valueFromAliases(row, headerMap, ["neighborLocation", "neighbor_location"]),
      );

      const latitude = toOptionalNumber(
        valueFromAliases(row, headerMap, ["latitude", "lat"]),
        "latitude",
      );
      const longitude = toOptionalNumber(
        valueFromAliases(row, headerMap, ["longitude", "lng", "lon"]),
        "longitude",
      );
      const googlePoint = toOptionalString(
        valueFromAliases(row, headerMap, ["googlePoint", "google_point"]),
      );
      const geolocationLink = toOptionalString(
        valueFromAliases(row, headerMap, ["geolocationLink", "geolocation_link"]),
      );
      const formattedAddress = toOptionalString(
        valueFromAliases(row, headerMap, ["formattedAddress", "formatted_address"]),
      );
      const placeId = toOptionalString(
        valueFromAliases(row, headerMap, ["placeId", "place_id"]),
      );

      // TitleDocument fields
      const titleDeedType = parseEnum(
        valueFromAliases(row, headerMap, ["titleDeedType", "title_deed_type"]),
        TitleTypeEnum,
        "titleDeedType",
      );
      const titleDeedNo = toOptionalString(
        valueFromAliases(row, headerMap, ["titleDeedNo", "title_deed_no"]),
      );
      const totalSizeByTitleDeed = toOptionalNumber(
        valueFromAliases(row, headerMap, ["totalSizeByTitleDeed", "total_size_by_title_deed"]),
        "totalSizeByTitleDeed",
        { min: 0 },
      );
      const stampDate = toOptionalDate(
        valueFromAliases(row, headerMap, ["stampDate", "stamp_date"]),
        "stampDate",
      );

      const transactionType = parseEnum(
        valueFromAliases(row, headerMap, ["transactionType", "transaction_type"]),
        TransactionType,
        "transactionType",
      );
      const transactionDate = toOptionalDate(
        valueFromAliases(row, headerMap, ["transactionDate", "transaction_date"]),
        "transactionDate",
      );
      const totalPrice = toOptionalNumber(
        valueFromAliases(row, headerMap, ["totalPrice", "total_price"]),
        "totalPrice",
        { min: 0 },
      );

      const hasAddressData =
        hasValue(provinceId) ||
        hasValue(districtId) ||
        hasValue(communeId) ||
        hasValue(villageId) ||
        hasValue(street) ||
        hasValue(houseNo) ||
        hasValue(accessRoads) ||
        hasValue(neighborLocation);

      const hasPropertyPhotoData = hasValue(frontSide) || hasValue(inside);

      const hasLocationData =
        hasValue(latitude) ||
        hasValue(longitude) ||
        hasValue(googlePoint) ||
        hasValue(geolocationLink) ||
        hasValue(formattedAddress) ||
        hasValue(placeId);

      const hasTransactionData =
        hasValue(transactionType) || hasValue(transactionDate) || hasValue(totalPrice);

      const hasTitleDocumentData =
        hasValue(titleDeedType) ||
        hasValue(titleDeedNo) ||
        hasValue(totalSizeByTitleDeed) ||
        hasValue(stampDate);

      if (hasLocationData && (latitude === undefined || longitude === undefined)) {
        throw new BadRequestError("latitude and longitude are required together");
      }

      let existingProperty:
        | (Prisma.PropertyGetPayload<{
            include: {
              propertyAddress: true;
              propertyLocation: true;
              titleDocument: true;
              propertyPhotos: true;
            };
          }>)
        | null = null;

      if (propertyId !== undefined) {
        existingProperty = await prisma.property.findUnique({
          where: { propertyId },
          include: {
            propertyAddress: true,
            propertyLocation: true,
            titleDocument: true,
            propertyPhotos: true,
          },
        });
        // If propertyId not found, fall through to try by propertyCode or create new
      }

      if (!existingProperty && rawPropertyCode) {
        existingProperty = await prisma.property.findUnique({
          where: { propertyCode: rawPropertyCode },
          include: {
            propertyAddress: true,
            propertyLocation: true,
            titleDocument: true,
            propertyPhotos: true,
          },
        });
      }

      // Only enforce ID/code mismatch when both resolve to records in the DB
      if (propertyId !== undefined && rawPropertyCode && existingProperty) {
        if (
          existingProperty.propertyCode !== rawPropertyCode &&
          existingProperty.propertyId !== propertyId
        ) {
          throw new BadRequestError(
            `propertyId ${propertyId} does not match propertyCode ${rawPropertyCode}`,
          );
        }
      }

      if (propertyTypeId !== undefined) {
        await getPropertyTypeName(propertyTypeId);
      }

      const resolvedPropertyTypeId = propertyTypeId ?? existingProperty?.propertyTypeId;

      let resolvedPropertyCode = rawPropertyCode;
      if (!existingProperty && !resolvedPropertyCode) {
        if (!resolvedPropertyTypeId) {
          throw new BadRequestError(
            "propertyCode or propertyTypeId is required for new property rows",
          );
        }

        const propertyTypeName = await getPropertyTypeName(resolvedPropertyTypeId);
        resolvedPropertyCode = await propertyCodeService.generateCode(propertyTypeName);
      }

      if (!existingProperty && !resolvedPropertyTypeId) {
        throw new BadRequestError("propertyTypeId is required for new property rows");
      }

      if (!existingProperty && !propertyName && !resolvedPropertyCode) {
        throw new BadRequestError("propertyName is required for new property rows");
      }

      if (hasTransactionData && (!transactionType || !transactionDate || totalPrice === undefined)) {
        throw new BadRequestError(
          "transactionType, transactionDate, and totalPrice are required together",
        );
      }

      if (hasTitleDocumentData && !titleDeedType && !existingProperty?.titleDocument?.titleDeedType) {
        throw new BadRequestError(
          "titleDeedType is required when importing titleDocument data",
        );
      }

      await prisma.$transaction(async (tx) => {
        if (existingProperty) {
          await tx.property.update({
            where: { propertyId: existingProperty.propertyId },
            data: {
              ...(propertyName !== undefined ? { propertyName } : {}),
              ...(resolvedPropertyCode !== undefined
                ? { propertyCode: resolvedPropertyCode }
                : {}),
              ...(propertyTypeId !== undefined ? { propertyTypeId } : {}),
              ...(propertySubtypeId !== undefined ? { propertySubtypeId } : {}),
              ...(currentUseId !== undefined ? { currentUseId } : {}),
              ...(status !== undefined ? { status } : {}),
              ...(workflowStatus !== undefined ? { workflowStatus } : {}),
              ...(description !== undefined ? { description } : {}),
              ...(actorUserId ? { updatedBy: actorUserId } : {}),
            },
          });

          if (hasAddressData) {
            const createProvinceId = provinceId ?? existingProperty.propertyAddress?.provinceId;
            const createDistrictId = districtId ?? existingProperty.propertyAddress?.districtId;
            const createCommuneId = communeId ?? existingProperty.propertyAddress?.communeId;

            if (!createProvinceId || !createDistrictId || !createCommuneId) {
              throw new BadRequestError(
                "provinceId, districtId, and communeId are required to create propertyAddress",
              );
            }

            await tx.propertyAddress.upsert({
              where: { propertyId: existingProperty.propertyId },
              create: {
                propertyId: existingProperty.propertyId,
                provinceId: createProvinceId,
                districtId: createDistrictId,
                communeId: createCommuneId,
                ...(villageId !== undefined ? { villageId } : {}),
                ...(street !== undefined ? { street } : {}),
                ...(houseNo !== undefined ? { houseNo } : {}),
                ...(accessRoads !== undefined ? { accessRoads } : {}),
                ...(neighborLocation !== undefined ? { neighborLocation } : {}),
              },
              update: {
                ...(provinceId !== undefined ? { provinceId } : {}),
                ...(districtId !== undefined ? { districtId } : {}),
                ...(communeId !== undefined ? { communeId } : {}),
                ...(villageId !== undefined ? { villageId } : {}),
                ...(street !== undefined ? { street } : {}),
                ...(houseNo !== undefined ? { houseNo } : {}),
                ...(accessRoads !== undefined ? { accessRoads } : {}),
                ...(neighborLocation !== undefined ? { neighborLocation } : {}),
              },
            });
          }

          if (hasLocationData) {
            await tx.propertyLocation.upsert({
              where: { propertyId: existingProperty.propertyId },
              create: {
                propertyId: existingProperty.propertyId,
                ...(latitude !== undefined ? { latitude } : {}),
                ...(longitude !== undefined ? { longitude } : {}),
                ...(googlePoint !== undefined ? { googlePoint } : {}),
                ...(geolocationLink !== undefined ? { geolocationLink } : {}),
                ...(formattedAddress !== undefined ? { formattedAddress } : {}),
                ...(placeId !== undefined ? { placeId } : {}),
              },
              update: {
                ...(latitude !== undefined ? { latitude } : {}),
                ...(longitude !== undefined ? { longitude } : {}),
                ...(googlePoint !== undefined ? { googlePoint } : {}),
                ...(geolocationLink !== undefined ? { geolocationLink } : {}),
                ...(formattedAddress !== undefined ? { formattedAddress } : {}),
                ...(placeId !== undefined ? { placeId } : {}),
              },
            });
          }

          if (hasPropertyPhotoData) {
            await tx.propertyPhoto.upsert({
              where: { propertyId: existingProperty.propertyId },
              create: {
                propertyId: existingProperty.propertyId,
                ...(frontSide !== undefined ? { frontSide } : {}),
                ...(inside !== undefined ? { inside } : {}),
              },
              update: {
                ...(frontSide !== undefined ? { frontSide } : {}),
                ...(inside !== undefined ? { inside } : {}),
              },
            });
          }

          if (hasTransactionData && transactionType && transactionDate && totalPrice !== undefined) {
            await tx.transaction.create({
              data: {
                propertyId: existingProperty.propertyId,
                transactionType,
                transactionDate,
                totalPrice,
              },
            });
          }

          if (hasTitleDocumentData) {
            const createTitleDeedType = titleDeedType ?? existingProperty.titleDocument?.titleDeedType;
            if (!createTitleDeedType) {
              throw new BadRequestError(
                "titleDeedType is required to create titleDocument",
              );
            }

            await tx.titleDocument.upsert({
              where: { propertyId: existingProperty.propertyId },
              create: {
                propertyId: existingProperty.propertyId,
                titleDeedType: createTitleDeedType,
                ...(titleDeedNo !== undefined ? { titleDeedNo } : {}),
                ...(totalSizeByTitleDeed !== undefined ? { totalSizeByTitleDeed } : {}),
                ...(stampDate !== undefined ? { stampDate } : {}),
              },
              update: {
                ...(titleDeedType !== undefined ? { titleDeedType } : {}),
                ...(titleDeedNo !== undefined ? { titleDeedNo } : {}),
                ...(totalSizeByTitleDeed !== undefined ? { totalSizeByTitleDeed } : {}),
                ...(stampDate !== undefined ? { stampDate } : {}),
              },
            });
          }
        } else {
          const propertyIdForCreate = resolvedPropertyTypeId as number;
          const propertyCodeForCreate = resolvedPropertyCode as string;

          const createAddress = hasAddressData
            ? (() => {
                if (!provinceId || !districtId || !communeId) {
                  throw new BadRequestError(
                    "provinceId, districtId, and communeId are required when importing propertyAddress",
                  );
                }

                return {
                  provinceId,
                  districtId,
                  communeId,
                  ...(villageId !== undefined ? { villageId } : {}),
                  ...(street !== undefined ? { street } : {}),
                  ...(houseNo !== undefined ? { houseNo } : {}),
                  ...(accessRoads !== undefined ? { accessRoads } : {}),
                  ...(neighborLocation !== undefined ? { neighborLocation } : {}),
                };
              })()
            : undefined;

          const createTitleDocument = hasTitleDocumentData
            ? (() => {
                if (!titleDeedType) {
                  throw new BadRequestError(
                    "titleDeedType is required when importing titleDocument",
                  );
                }

                return {
                  titleDeedType,
                  ...(titleDeedNo !== undefined ? { titleDeedNo } : {}),
                  ...(totalSizeByTitleDeed !== undefined ? { totalSizeByTitleDeed } : {}),
                  ...(stampDate !== undefined ? { stampDate } : {}),
                };
              })()
            : undefined;

          await tx.property.create({
            data: {
              propertyCode: propertyCodeForCreate,
              propertyName: propertyName ?? propertyCodeForCreate,
              propertyTypeId: propertyIdForCreate,
              ...(propertySubtypeId !== undefined ? { propertySubtypeId } : {}),
              ...(currentUseId !== undefined ? { currentUseId } : {}),
              ...(status !== undefined ? { status } : {}),
              ...(workflowStatus !== undefined ? { workflowStatus } : {}),
              ...(description !== undefined ? { description } : {}),
              ...(actorUserId ? { createdBy: actorUserId, updatedBy: actorUserId } : {}),
              ...(createAddress ? { propertyAddress: { create: createAddress } } : {}),
              ...(createTitleDocument ? { titleDocument: { create: createTitleDocument } } : {}),
              ...(hasPropertyPhotoData
                ? {
                    propertyPhotos: {
                      create: {
                        ...(frontSide !== undefined ? { frontSide } : {}),
                        ...(inside !== undefined ? { inside } : {}),
                      },
                    },
                  }
                : {}),
              ...(hasLocationData
                ? {
                    propertyLocation: {
                      create: {
                        ...(latitude !== undefined ? { latitude } : {}),
                        ...(longitude !== undefined ? { longitude } : {}),
                        ...(googlePoint !== undefined ? { googlePoint } : {}),
                        ...(geolocationLink !== undefined ? { geolocationLink } : {}),
                        ...(formattedAddress !== undefined ? { formattedAddress } : {}),
                        ...(placeId !== undefined ? { placeId } : {}),
                      },
                    },
                  }
                : {}),
              ...(hasTransactionData && transactionType && transactionDate && totalPrice !== undefined
                ? {
                    transaction: {
                      create: {
                        transactionType,
                        transactionDate,
                        totalPrice,
                      },
                    },
                  }
                : {}),
            },
          });
        }
      });

      if (existingProperty) {
        updated += 1;
      } else {
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
