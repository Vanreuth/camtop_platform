import {
  AccountStatus,
  Prisma,
  PropertyIndicativeValuationStatus,
  PropertyStatus,
  PropertyValuationStatus,
  ReportTypeEnum,
  ValuationMethod,
  WorkflowStatus,
} from "@prisma/client";
import { prisma } from "../../db/prisma";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { ForbiddenError } from "../../common/errors/forbidden.error";
import { NotFoundError } from "../../common/errors/notFound.error";
import { FileUploadService } from "../../services/fileUpload.service";
import {
  exportPropertiesToExcel,
  type PropertyExcelExportFilters,
} from "../property/property.excel.service";
import {
  exportPropertyValuationsToExcel,
  type PropertyValuationExcelExportFilters,
} from "../propertyValuation/propertyValuation.excel.service";
import {
  exportIndicativeValuationsToExcel,
} from "../indicativeValuation/indicativeValuation.excel.service";
import {
  IndicativeValuationRepository,
} from "../indicativeValuation/indicativeValuation.repository";
import { sumComponentValueRangeNumber } from "../indicativeValuation/indicativeValuation.calculation";
import {
  exportUsersToExcel,
  getUsersForExport,
  type UserReportExportFilters,
} from "../user/user.excel.service";
import type {
  CreateReportDto,
  ReportFormat,
  ReportListQueryDto,
  ReportTarget,
} from "./report.dto";
import {
  createTablePdfBuffer,
  type PdfReportColumn,
} from "./report.pdf.service";

type AuthUserContext = {
  id: number;
  username: string;
  email: string;
  roles: Array<{
    roleCode: string;
    hierarchyLevel: number;
  }>;
  permissions: string[];
};

type ReportMetadata = {
  reportCenterVersion: 1;
  reportTarget: ReportTarget;
  format: ReportFormat;
  summary?: string;
  description?: string;
};

const REPORT_INCLUDE = {
  generatedByUser: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} satisfies Prisma.GeneratedReportInclude;

type StoredReportRecord = Prisma.GeneratedReportGetPayload<{
  include: typeof REPORT_INCLUDE;
}>;

type GeneratedReportResponse = StoredReportRecord & {
  reportTarget: ReportTarget;
  format: ReportFormat;
  summary: string | null;
  description: string | null;
};

type ReportFilePayload = {
  buffer: Uint8Array | Buffer;
  contentType: string;
  extension: "xlsx" | "pdf";
  storedReportType: ReportTypeEnum;
  summary?: string;
};

const REPORT_TARGET_TO_STORED_TYPE: Record<ReportTarget, ReportTypeEnum> = {
  USER: ReportTypeEnum.USER_ACTIVITY,
  PROPERTY: ReportTypeEnum.PROPERTY_LISTING,
  PROPERTY_VALUATION: ReportTypeEnum.VALUATION,
  INDICATIVE_VALUATION: ReportTypeEnum.AUDIT_LOG,
};

const STORED_TYPE_TO_REPORT_TARGET: Record<ReportTypeEnum, ReportTarget> = {
  [ReportTypeEnum.USER_ACTIVITY]: "USER",
  [ReportTypeEnum.PROPERTY_LISTING]: "PROPERTY",
  [ReportTypeEnum.VALUATION]: "PROPERTY_VALUATION",
  [ReportTypeEnum.AUDIT_LOG]: "INDICATIVE_VALUATION",
};

const REPORT_TARGET_BASE_NAME: Record<ReportTarget, string> = {
  USER: "user-report",
  PROPERTY: "property-report",
  PROPERTY_VALUATION: "property-valuation-report",
  INDICATIVE_VALUATION: "indicative-valuation-report",
};

const REPORT_TITLES: Record<ReportTarget, string> = {
  USER: "User Report",
  PROPERTY: "Property Report",
  PROPERTY_VALUATION: "Property Valuation Report",
  INDICATIVE_VALUATION: "Indicative Valuation Report",
};

const indicativeValuationRepository = new IndicativeValuationRepository();

const toOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

const toOptionalDate = (value: unknown): Date | undefined => {
  const normalized = toOptionalString(value);
  if (!normalized) return undefined;

  const parsedValue = new Date(normalized);
  return Number.isNaN(parsedValue.getTime()) ? undefined : parsedValue;
};

const toOptionalEnum = <T extends string>(
  value: unknown,
  enumObject: Record<string, T>,
): T | undefined => {
  const normalized = toOptionalString(value);
  if (!normalized) return undefined;

  const enumValues = Object.values(enumObject) as string[];
  const upperValue = normalized.toUpperCase();
  const matched = enumValues.find((item) => item.toUpperCase() === upperValue);
  return matched as T | undefined;
};

const toReadableFilterKey = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const sanitizeFileName = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 100);

const ensureExtension = (fileName: string, extension: string) => {
  const suffix = `.${extension}`;
  return fileName.toLowerCase().endsWith(suffix) ? fileName : `${fileName}${suffix}`;
};

const formatTimestamp = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const seconds = String(value.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
};

const getReportBaseName = (reportTarget: ReportTarget) =>
  REPORT_TARGET_BASE_NAME[reportTarget] ?? "generated-report";

const canViewAllReports = (user: AuthUserContext) =>
  user.roles.some((role) => role.hierarchyLevel <= 2);

const hasHierarchyLevel = (user: AuthUserContext, level: number) =>
  user.roles.some((role) => role.hierarchyLevel <= level);

const hasAnyPermission = (user: AuthUserContext, permissions: string[]) =>
  permissions.some((permission) => user.permissions.includes(permission));

const assertReportAccess = (
  report: { generatedByUserId: number },
  user: AuthUserContext,
) => {
  if (canViewAllReports(user)) {
    return;
  }

  if (report.generatedByUserId !== user.id) {
    throw new ForbiddenError("You do not have permission to access this report");
  }
};

const assertGeneratePermission = (target: ReportTarget, user: AuthUserContext) => {
  if (target === "USER") {
    const canAccessUsers =
      hasHierarchyLevel(user, 2) || hasAnyPermission(user, ["user:read", "user:manage"]);

    if (!canAccessUsers) {
      throw new ForbiddenError("You do not have permission to generate user reports");
    }
    return;
  }

  const canAccessPropertyData =
    hasHierarchyLevel(user, 3) ||
    hasAnyPermission(user, ["property:read", "dashboard:read"]);

  if (!canAccessPropertyData) {
    throw new ForbiddenError("You do not have permission to generate this report");
  }
};

const encodeMetadata = (metadata: ReportMetadata) => JSON.stringify(metadata);

const parseMetadata = (value?: string | null): ReportMetadata | null => {
  const normalized = value?.trim();
  if (!normalized) return null;

  try {
    const parsed = JSON.parse(normalized) as Partial<ReportMetadata>;
    if (
      parsed?.reportCenterVersion === 1 &&
      parsed.reportTarget &&
      parsed.format
    ) {
      return {
        reportCenterVersion: 1,
        reportTarget: parsed.reportTarget,
        format: parsed.format,
        summary: parsed.summary,
        description: parsed.description,
      };
    }
  } catch {
    return null;
  }

  return null;
};

const inferFormatFromName = (reportName?: string | null): ReportFormat =>
  reportName?.toLowerCase().endsWith(".pdf") ? "PDF" : "XLSX";

const normalizeReportRecord = (report: StoredReportRecord): GeneratedReportResponse => {
  const metadata = parseMetadata(report.description);

  return {
    ...report,
    reportTarget:
      metadata?.reportTarget ?? STORED_TYPE_TO_REPORT_TARGET[report.reportType],
    format: metadata?.format ?? inferFormatFromName(report.reportName),
    summary: metadata?.summary ?? null,
    description:
      metadata?.description ?? (metadata ? null : report.description ?? null),
  };
};

const buildPropertyFilters = (
  filters: Record<string, unknown> | undefined,
): PropertyExcelExportFilters => ({
  search: toOptionalString(filters?.search),
  status: toOptionalEnum(filters?.status, PropertyStatus),
  workflowStatus: toOptionalEnum(filters?.workflowStatus, WorkflowStatus),
  propertyTypeId: toOptionalNumber(filters?.propertyTypeId),
  provinceId: toOptionalString(filters?.provinceId),
  districtId: toOptionalString(filters?.districtId),
  communeId: toOptionalString(filters?.communeId),
  villageId: toOptionalString(filters?.villageId),
  minPrice: toOptionalNumber(filters?.minPrice),
  maxPrice: toOptionalNumber(filters?.maxPrice),
  createdById: toOptionalNumber(filters?.createdById),
  createdAfter: toOptionalDate(filters?.createdAfter),
  createdBefore: toOptionalDate(filters?.createdBefore),
});

const buildValuationFilters = (
  filters: Record<string, unknown> | undefined,
): PropertyValuationExcelExportFilters => ({
  search: toOptionalString(filters?.search),
  status: toOptionalEnum(filters?.status, PropertyValuationStatus),
  workflowStatus: toOptionalEnum(filters?.workflowStatus, WorkflowStatus),
  valuationMethod: toOptionalEnum(filters?.valuationMethod, ValuationMethod),
  valuerId: toOptionalNumber(filters?.valuerId),
  propertyId: toOptionalNumber(filters?.propertyId),
  propertyTypeId: toOptionalNumber(filters?.propertyTypeId),
  preparedFor: toOptionalString(filters?.preparedFor),
  purposeOfValuation: toOptionalString(filters?.purposeOfValuation),
  provinceId: toOptionalString(filters?.provinceId),
  districtId: toOptionalString(filters?.districtId),
  communeId: toOptionalString(filters?.communeId),
  villageId: toOptionalString(filters?.villageId),
  valuationDateFrom: toOptionalDate(filters?.valuationDateFrom),
  valuationDateTo: toOptionalDate(filters?.valuationDateTo),
  minValue: toOptionalNumber(filters?.minValue),
  maxValue: toOptionalNumber(filters?.maxValue),
});

const buildUserFilters = (
  filters: Record<string, unknown> | undefined,
): UserReportExportFilters => ({
  search: toOptionalString(filters?.search),
  status: toOptionalEnum(filters?.status, AccountStatus),
  role: toOptionalString(filters?.role),
  createdAfter: toOptionalDate(filters?.createdAfter),
  createdBefore: toOptionalDate(filters?.createdBefore),
});

const buildIndicativeFilters = (filters: Record<string, unknown> | undefined) => ({
  propertyId: toOptionalNumber(filters?.propertyId),
  propertyTypeId: toOptionalNumber(filters?.propertyTypeId),
  instructedBy: toOptionalString(filters?.instructedBy),
  preparedFor: toOptionalString(filters?.preparedFor),
  intendedUse: toOptionalString(filters?.intendedUse),
  purposeOfValuation: toOptionalString(filters?.purposeOfValuation),
  provinceId: toOptionalString(filters?.provinceId),
  districtId: toOptionalString(filters?.districtId),
  communeId: toOptionalString(filters?.communeId),
  villageId: toOptionalString(filters?.villageId),
  minMarketValue:
    toOptionalNumber(filters?.minMarketValue) ?? toOptionalNumber(filters?.minValue),
  maxMarketValue:
    toOptionalNumber(filters?.maxMarketValue) ?? toOptionalNumber(filters?.maxValue),
  valuerId: toOptionalNumber(filters?.valuerId),
  status: toOptionalEnum(
    filters?.status,
    PropertyIndicativeValuationStatus,
  ),
  workflowStatus: toOptionalEnum(filters?.workflowStatus, WorkflowStatus),
  search: toOptionalString(filters?.search),
  createdAfter: toOptionalDate(filters?.createdAfter),
  createdBefore: toOptionalDate(filters?.createdBefore),
  page: 1,
  limit: 10,
  sortBy: "createdAt",
  sortOrder: "desc" as const,
});

const summarizeFilters = (filters: Record<string, unknown> | undefined) => {
  if (!filters) {
    return undefined;
  }

  const entries = Object.entries(filters).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });

  if (!entries.length) {
    return undefined;
  }

  return entries
    .slice(0, 8)
    .map(([key, value]) => `${toReadableFilterKey(key)}: ${String(value)}`)
    .join(" | ");
};

const formatDateCell = (value?: Date | null) =>
  value
    ? value.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
    : "-";

const formatMoneyCell = (
  value?: Prisma.Decimal | number | string | null,
  currency = "USD",
) => {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${currency} ${numeric.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getUserDisplayName = (user: AuthUserContext) => user.username || user.email;

const buildPdfPayload = async (
  input: {
    reportTarget: ReportTarget;
    summary?: string;
    filters?: Record<string, unknown>;
  },
  currentUser: AuthUserContext,
) => {
  const generatedAt = new Date();
  const subtitle = `Generated from CAMTOP Report Center`;
  const fallbackSummary = input.summary ?? "No filters applied";

  switch (input.reportTarget) {
    case "USER": {
      const users = await getUsersForExport(buildUserFilters(input.filters));
      const columns: PdfReportColumn[] = [
        { key: "username", label: "Username", width: 90 },
        { key: "fullName", label: "Full Name", width: 120 },
        { key: "email", label: "Email", width: 180 },
        { key: "status", label: "Status", width: 80 },
        { key: "roleName", label: "Role", width: 130 },
        { key: "createdAt", label: "Created", width: 95 },
      ];
      const rows = users.map((user) => ({
        username: user.username,
        fullName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "-",
        email: user.email,
        status: user.status,
        roleName: user.roleName,
        createdAt: formatDateCell(user.createdAt),
      }));

      const buffer = await createTablePdfBuffer({
        title: REPORT_TITLES.USER,
        subtitle,
        summary: fallbackSummary,
        generatedAt,
        generatedBy: getUserDisplayName(currentUser),
        columns,
        rows:
          rows.length > 0
            ? rows
            : [
                {
                  username: "No matching records",
                  fullName: "-",
                  email: "-",
                  status: "-",
                  roleName: "-",
                  createdAt: "-",
                },
              ],
      });

      return buffer;
    }
    case "PROPERTY": {
      const filters = buildPropertyFilters(input.filters);
      const conditions: Prisma.PropertyWhereInput[] = [];

      if (filters.status) conditions.push({ status: filters.status });
      if (filters.workflowStatus) conditions.push({ workflowStatus: filters.workflowStatus });
      if (filters.propertyTypeId) conditions.push({ propertyTypeId: filters.propertyTypeId });
      if (filters.createdById) conditions.push({ createdBy: filters.createdById });
      if (filters.createdAfter || filters.createdBefore) {
        conditions.push({
          createdAt: {
            ...(filters.createdAfter ? { gte: filters.createdAfter } : {}),
            ...(filters.createdBefore ? { lte: filters.createdBefore } : {}),
          },
        });
      }
      if (filters.provinceId || filters.districtId || filters.communeId || filters.villageId) {
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
      if (filters.minPrice || filters.maxPrice) {
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
          ],
        });
      }

      const properties = await prisma.property.findMany({
        where: conditions.length ? { AND: conditions } : {},
        select: {
          propertyCode: true,
          propertyName: true,
          status: true,
          workflowStatus: true,
          propertyType: {
            select: {
              propertyName: true,
            },
          },
          propertyAddress: {
            select: {
              province: { select: { nameEn: true, nameKh: true } },
              district: { select: { nameEn: true, nameKh: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const columns: PdfReportColumn[] = [
        { key: "propertyCode", label: "Code", width: 90 },
        { key: "propertyName", label: "Property", width: 150 },
        { key: "propertyType", label: "Type", width: 110 },
        { key: "status", label: "Status", width: 80 },
        { key: "workflowStatus", label: "Workflow", width: 95 },
        { key: "location", label: "Location", width: 120 },
      ];
      const rows = properties.map((property) => ({
        propertyCode: property.propertyCode,
        propertyName: property.propertyName,
        propertyType: property.propertyType?.propertyName ?? "-",
        status: property.status,
        workflowStatus: property.workflowStatus,
        location:
          property.propertyAddress?.district?.nameEn ??
          property.propertyAddress?.district?.nameKh ??
          property.propertyAddress?.province?.nameEn ??
          property.propertyAddress?.province?.nameKh ??
          "-",
      }));

      return createTablePdfBuffer({
        title: REPORT_TITLES.PROPERTY,
        subtitle,
        summary: fallbackSummary,
        generatedAt,
        generatedBy: getUserDisplayName(currentUser),
        columns,
        rows:
          rows.length > 0
            ? rows
            : [
                {
                  propertyCode: "No matching records",
                  propertyName: "-",
                  propertyType: "-",
                  status: "-",
                  workflowStatus: "-",
                  location: "-",
                },
              ],
      });
    }
    case "PROPERTY_VALUATION": {
      const filters = buildValuationFilters(input.filters);
      const conditions: Prisma.PropertyValuationWhereInput[] = [];

      if (filters.status) conditions.push({ status: filters.status });
      if (filters.workflowStatus) conditions.push({ workflowStatus: filters.workflowStatus });
      if (filters.valuationMethod) conditions.push({ valuationMethod: filters.valuationMethod });
      if (filters.valuerId) conditions.push({ valuerId: filters.valuerId });
      if (filters.propertyId) conditions.push({ propertyId: filters.propertyId });
      if (filters.preparedFor) conditions.push({ preparedFor: filters.preparedFor });
      if (filters.purposeOfValuation) {
        conditions.push({ purposeOfValuation: { contains: filters.purposeOfValuation, mode: Prisma.QueryMode.insensitive } });
      }
      if (filters.valuationDateFrom || filters.valuationDateTo) {
        conditions.push({
          valuationDate: {
            ...(filters.valuationDateFrom ? { gte: filters.valuationDateFrom } : {}),
            ...(filters.valuationDateTo ? { lte: filters.valuationDateTo } : {}),
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
      if (filters.propertyTypeId || filters.provinceId || filters.districtId || filters.communeId || filters.villageId) {
        conditions.push({
          property: {
            is: {
              ...(filters.propertyTypeId ? { propertyTypeId: filters.propertyTypeId } : {}),
              ...(filters.provinceId || filters.districtId || filters.communeId || filters.villageId
                ? {
                    propertyAddress: {
                      is: {
                        ...(filters.provinceId ? { provinceId: filters.provinceId } : {}),
                        ...(filters.districtId ? { districtId: filters.districtId } : {}),
                        ...(filters.communeId ? { communeId: filters.communeId } : {}),
                        ...(filters.villageId ? { villageId: filters.villageId } : {}),
                      },
                    },
                  }
                : {}),
            },
          },
        });
      }
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
                  ],
                },
              },
            },
          ],
        });
      }

      const valuations = await prisma.propertyValuation.findMany({
        where: conditions.length ? { AND: conditions } : {},
        select: {
          valuationNo: true,
          valuationDate: true,
          status: true,
          workflowStatus: true,
          marketValue: true,
          currency: true,
          property: {
            select: {
              propertyName: true,
            },
          },
          valuer: {
            select: {
              username: true,
            },
          },
        },
        orderBy: { valuationDate: "desc" },
      });

      const columns: PdfReportColumn[] = [
        { key: "valuationNo", label: "Valuation No", width: 95 },
        { key: "propertyName", label: "Property", width: 180 },
        { key: "status", label: "Status", width: 80 },
        { key: "workflowStatus", label: "Workflow", width: 95 },
        { key: "marketValue", label: "Market Value", width: 110, align: "right" },
        { key: "valuationDate", label: "Valuation Date", width: 110 },
      ];
      const rows = valuations.map((valuation) => ({
        valuationNo: valuation.valuationNo,
        propertyName: valuation.property?.propertyName ?? "-",
        status: valuation.status,
        workflowStatus: valuation.workflowStatus,
        marketValue: formatMoneyCell(valuation.marketValue, valuation.currency),
        valuationDate: formatDateCell(valuation.valuationDate),
      }));

      return createTablePdfBuffer({
        title: REPORT_TITLES.PROPERTY_VALUATION,
        subtitle,
        summary: fallbackSummary,
        generatedAt,
        generatedBy: getUserDisplayName(currentUser),
        columns,
        rows:
          rows.length > 0
            ? rows
            : [
                {
                  valuationNo: "No matching records",
                  propertyName: "-",
                  status: "-",
                  workflowStatus: "-",
                  marketValue: "-",
                  valuationDate: "-",
                },
              ],
      });
    }
    case "INDICATIVE_VALUATION": {
      const valuations = await indicativeValuationRepository.findForExport(
        buildIndicativeFilters(input.filters),
      );
      const columns: PdfReportColumn[] = [
        { key: "indicationNo", label: "Indication No", width: 85 },
        { key: "propertyName", label: "Property", width: 110 },
        { key: "instructedBy", label: "Instructed By", width: 95 },
        { key: "status", label: "Status", width: 80 },
        { key: "workflowStatus", label: "Workflow", width: 80 },
        { key: "valuer", label: "Valuer", width: 80 },
        { key: "marketRange", label: "Market Range", width: 115, align: "right" },
        { key: "indicationDate", label: "Indication Date", width: 110 },
      ];
      const rows = valuations.map((valuation) => {
        const marketTotals = sumComponentValueRangeNumber(valuation.components);
        const valuer =
          valuation.valuer?.username ||
          `${valuation.valuer?.firstName ?? ""} ${valuation.valuer?.lastName ?? ""}`.trim() ||
          "-";

        return {
          indicationNo: valuation.indicationNo ?? "-",
          propertyName: valuation.property?.propertyName ?? "-",
          instructedBy: valuation.instructedBy ?? "-",
          status: valuation.status,
          workflowStatus: valuation.workflowStatus,
          valuer,
          marketRange:
            marketTotals.min !== null && marketTotals.max !== null
              ? `${formatMoneyCell(marketTotals.min, valuation.currency)} - ${formatMoneyCell(
                  marketTotals.max,
                  valuation.currency,
                )}`
              : "-",
          indicationDate: formatDateCell(valuation.indicationDate),
        };
      });

      return createTablePdfBuffer({
        title: REPORT_TITLES.INDICATIVE_VALUATION,
        subtitle,
        summary: fallbackSummary,
        generatedAt,
        generatedBy: getUserDisplayName(currentUser),
        columns,
        rows:
          rows.length > 0
            ? rows
            : [
                {
                  indicationNo: "No matching records",
                  propertyName: "-",
                  instructedBy: "-",
                  status: "-",
                  workflowStatus: "-",
                  valuer: "-",
                  marketRange: "-",
                  indicationDate: "-",
                },
              ],
      });
    }
    default:
      throw new BadRequestError("This report target is not supported");
  }
};

const buildReportBuffer = async (
  input: CreateReportDto,
  currentUser: AuthUserContext,
): Promise<ReportFilePayload> => {
  const storedReportType = REPORT_TARGET_TO_STORED_TYPE[input.reportTarget];

  if (input.format === "PDF") {
    return {
      buffer: await buildPdfPayload(
        {
          reportTarget: input.reportTarget,
          summary: summarizeFilters(input.filters),
          filters: input.filters,
        },
        currentUser,
      ),
      contentType: "application/pdf",
      extension: "pdf",
      storedReportType,
      summary: summarizeFilters(input.filters),
    };
  }

  switch (input.reportTarget) {
    case "USER":
      return {
        buffer: await exportUsersToExcel(buildUserFilters(input.filters)),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
        storedReportType,
        summary: summarizeFilters(input.filters),
      };
    case "PROPERTY":
      return {
        buffer: await exportPropertiesToExcel(buildPropertyFilters(input.filters)),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
        storedReportType,
        summary: summarizeFilters(input.filters),
      };
    case "PROPERTY_VALUATION":
      return {
        buffer: await exportPropertyValuationsToExcel(buildValuationFilters(input.filters)),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
        storedReportType,
        summary: summarizeFilters(input.filters),
      };
    case "INDICATIVE_VALUATION":
      return {
        buffer: await exportIndicativeValuationsToExcel(buildIndicativeFilters(input.filters)),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: "xlsx",
        storedReportType,
        summary: summarizeFilters(input.filters),
      };
    default:
      throw new BadRequestError("This report target is not supported");
  }
};

export class ReportService {
  async listReports(query: ReportListQueryDto, currentUser: AuthUserContext) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const storedReportType =
      query.reportType ??
      (query.reportTarget ? REPORT_TARGET_TO_STORED_TYPE[query.reportTarget] : undefined);
    const formatExtension =
      query.format === "PDF" ? ".pdf" : query.format === "XLSX" ? ".xlsx" : undefined;

    const baseWhere: Prisma.GeneratedReportWhereInput = {
      ...(storedReportType ? { reportType: storedReportType } : {}),
      ...(formatExtension
        ? {
            reportName: {
              endsWith: formatExtension,
              mode: Prisma.QueryMode.insensitive,
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                reportName: {
                  contains: query.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                description: {
                  contains: query.search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const normalizedGeneratedByMe =
      query.generatedByMe === true || query.generatedByMe === "true";

    const where: Prisma.GeneratedReportWhereInput =
      normalizedGeneratedByMe || !canViewAllReports(currentUser)
        ? { ...baseWhere, generatedByUserId: currentUser.id }
        : baseWhere;

    const myReportsWhere: Prisma.GeneratedReportWhereInput = {
      ...baseWhere,
      generatedByUserId: currentUser.id,
    };

    const [reports, total, myReports, latestReport] = await Promise.all([
      prisma.generatedReport.findMany({
        where,
        include: REPORT_INCLUDE,
        orderBy: { generatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.generatedReport.count({ where }),
      prisma.generatedReport.count({ where: myReportsWhere }),
      prisma.generatedReport.findFirst({
        where,
        orderBy: { generatedAt: "desc" },
        select: {
          generatedAt: true,
        },
      }),
    ]);

    return {
      data: reports.map(normalizeReportRecord),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
      summary: {
        totalReports: total,
        myReports,
        latestGeneratedAt: latestReport?.generatedAt ?? null,
      },
    };
  }

  async generateReport(input: CreateReportDto, currentUser: AuthUserContext) {
    assertGeneratePermission(input.reportTarget, currentUser);

    const publicUrlBase = process.env.CLOUDFLARE_R2_PUBLIC_URL;
    if (!publicUrlBase) {
      throw new BadRequestError("Report storage is not configured");
    }

    const { buffer, contentType, extension, storedReportType, summary } =
      await buildReportBuffer(input, currentUser);

    const now = new Date();
    const fallbackName = `${getReportBaseName(input.reportTarget)}-${formatTimestamp(now)}.${extension}`;
    const normalizedBaseName =
      sanitizeFileName(input.reportName || fallbackName) || fallbackName;
    const normalizedReportName = ensureExtension(normalizedBaseName, extension);
    const objectKey = `reports/${currentUser.id}/${Date.now()}-${normalizedReportName}`;

    await FileUploadService.uploadBuffer(Buffer.from(buffer), objectKey, contentType);

    const report = await prisma.generatedReport.create({
      data: {
        reportName: normalizedReportName,
        reportType: storedReportType,
        generatedByUserId: currentUser.id,
        userId: currentUser.id,
        fileUrl: `${publicUrlBase}/${objectKey}`,
        description: encodeMetadata({
          reportCenterVersion: 1,
          reportTarget: input.reportTarget,
          format: input.format,
          summary,
          description: input.description?.trim() || undefined,
        }),
      },
      include: REPORT_INCLUDE,
    });

    const downloadUrl = await FileUploadService.signedDownloadUrl(report.fileUrl, 600, {
      filename: report.reportName,
    });

    return {
      report: normalizeReportRecord(report),
      downloadUrl,
    };
  }

  async getReportDownload(reportId: number, currentUser: AuthUserContext) {
    const report = await prisma.generatedReport.findUnique({
      where: { reportId },
      include: REPORT_INCLUDE,
    });

    if (!report) {
      throw new NotFoundError("Report not found");
    }

    assertReportAccess(report, currentUser);

    const downloadUrl = await FileUploadService.signedDownloadUrl(report.fileUrl, 600, {
      filename: report.reportName,
    });

    return {
      report: normalizeReportRecord(report),
      downloadUrl,
    };
  }
}

export const reportService = new ReportService();
