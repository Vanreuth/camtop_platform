import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { sumComponentValueRangeNumber } from "./indicativeValuation.calculation";
import { IndicativeValuationFiltersDTO } from "./indicativeValuation.dto";

const userSummarySelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  profilePicture: true,
} satisfies Prisma.UserSelect;

const auditUserSelect = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  phone: true,
} satisfies Prisma.UserSelect;

const propertyInclude = {
  propertyType: true,
  propertySubtype: true,
  currentUse: true,
  propertyAddress: {
    include: { province: true, district: true, commune: true, village: true },
  },
  propertyLocation: true,
  titleDocument: true,
  dataSource: true,
  propertyPhotos: true,
} satisfies Prisma.PropertyInclude;

export const indicativeValuationSelect = {
  indicationId: true,
  propertyId: true,
  indicationNo: true,
  instructionDate: true,
  indicationDate: true,
  instructedBy: true,
  intendedUse: true,
  forcedSalePercent: true,
  forcedSaleValue: true,
  currency: true,
  contactName: true,
  contactTel: true,
  accessValue: true,
  minAccessValue: true,
  maxAccessValue: true,
  feeRate: true,
  discount: true,
  chargeFee: true,
  minChargeFee: true,
  maxChargeFee: true,
  valuerId: true,
  inspectorName: true,
  status: true,
  workflowStatus: true,
  rejectionReason: true,
  note: true,
  internalNotes: true,
  indicativePdfStorageKey: true,
  indicativePdfFileName: true,
  indicativePdfMimeType: true,
  indicativePdfFileSize: true,
  indicativePdfGeneratedAt: true,
  approvedBy: true,
  rejectedBy: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
  property: {
    include: propertyInclude,
  },
  valuer: {
    select: userSummarySelect,
  },
  approvedUser: {
    select: userSummarySelect,
  },
  rejectedUser: {
    select: userSummarySelect,
  },
  createdByUser: {
    select: auditUserSelect,
  },
  updatedByUser: {
    select: auditUserSelect,
  },
  components: {
    orderBy: [
      { sortOrder: Prisma.SortOrder.asc },
      { id: Prisma.SortOrder.asc },
    ],
  },
} satisfies Prisma.PropertyIndicativeValuationSelect;

export type IndicativeValuationWithRelations = Prisma.PropertyIndicativeValuationGetPayload<{
  select: typeof indicativeValuationSelect;
}>;

const sortFieldMap: Record<string, string> = {
  id: "indicationId",
  valuationId: "indicationId",
  valuationNo: "indicationNo",
  indicationNo: "indicationNo",
  valuationDate: "indicationDate",
  indicationDate: "indicationDate",
  dateOfInspection: "instructionDate",
  instructionDate: "instructionDate",
  preparedFor: "instructedBy",
  instructedBy: "instructedBy",
  minMarketValue: "minMarketValue",
  maxMarketValue: "maxMarketValue",
};

const fallbackSortFields = new Set([
  "indicationId",
  "propertyId",
  "currency",
  "status",
  "workflowStatus",
  "valuerId",
  "createdAt",
  "updatedAt",
  "indicationNo",
  "indicationDate",
  "instructionDate",
  "instructedBy",
  "minMarketValue",
  "maxMarketValue",
]);

type RecordWithMarketTotals = {
  record: IndicativeValuationWithRelations;
  minMarketValue: number;
  maxMarketValue: number;
};

function toComparableValue(value: unknown) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "boolean") return value ? 1 : 0;
  return String(value).toLowerCase();
}

function compareValues(left: unknown, right: unknown, sortOrder: Prisma.SortOrder) {
  const leftValue = toComparableValue(left);
  const rightValue = toComparableValue(right);

  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;

  const comparison =
    typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), "en", {
          sensitivity: "base",
          numeric: true,
        });

  return sortOrder === Prisma.SortOrder.asc ? comparison : -comparison;
}

function getSortValue(entry: RecordWithMarketTotals, sortField: string) {
  if (sortField === "minMarketValue") return entry.minMarketValue;
  if (sortField === "maxMarketValue") return entry.maxMarketValue;
  return entry.record[sortField as keyof IndicativeValuationWithRelations] ?? null;
}

function attachMarketTotals(records: IndicativeValuationWithRelations[]) {
  return records.map((record) => {
    const totals = sumComponentValueRangeNumber(record.components);
    return {
      record,
      minMarketValue: totals.min ?? 0,
      maxMarketValue: totals.max ?? 0,
    };
  });
}

function buildPropertyFilters(filters: IndicativeValuationFiltersDTO): Prisma.PropertyWhereInput {
  const { propertyTypeId, provinceId, districtId, communeId, villageId } = filters;

  return {
    ...(propertyTypeId ? { propertyTypeId } : {}),
    ...(provinceId || districtId || communeId || villageId
      ? {
          propertyAddress: {
            is: {
              ...(provinceId ? { provinceId } : {}),
              ...(districtId ? { districtId } : {}),
              ...(communeId ? { communeId } : {}),
              ...(villageId ? { villageId } : {}),
            },
          },
        }
      : {}),
  };
}

function buildWhere(filters: IndicativeValuationFiltersDTO): Prisma.PropertyIndicativeValuationWhereInput {
  const {
    search,
    createdAfter,
    createdBefore,
    propertyId,
    valuerId,
    status,
    workflowStatus,
    instructedBy,
    preparedFor,
    intendedUse,
    purposeOfValuation,
  } = filters;
  const propertyFilters = buildPropertyFilters(filters);

  return {
    ...(propertyId && { propertyId }),
    ...(valuerId && { valuerId }),
    ...(status && { status }),
    ...(workflowStatus && { workflowStatus }),
    ...((instructedBy || preparedFor)
      ? { instructedBy: instructedBy ?? preparedFor }
      : {}),
    ...((intendedUse || purposeOfValuation)
      ? { intendedUse: intendedUse ?? purposeOfValuation }
      : {}),
    ...(Object.keys(propertyFilters).length > 0
      ? {
          property: {
            is: propertyFilters,
          },
        }
      : {}),
    ...(createdAfter || createdBefore
      ? {
          createdAt: {
            ...(createdAfter ? { gte: createdAfter } : {}),
            ...(createdBefore ? { lte: createdBefore } : {}),
          },
        }
      : {}),
    ...(search && {
      OR: [
        { indicationNo: { contains: search, mode: "insensitive" } },
        { instructedBy: { contains: search, mode: "insensitive" } },
        { contactName: { contains: search, mode: "insensitive" } },
        { contactTel: { contains: search, mode: "insensitive" } },
        { intendedUse: { contains: search, mode: "insensitive" } },
        { property: { is: { propertyName: { contains: search, mode: "insensitive" } } } },
        { property: { is: { propertyCode: { contains: search, mode: "insensitive" } } } },
      ],
    }),
  };
}

function applyMarketRangeFilterAndSort(
  records: IndicativeValuationWithRelations[],
  filters: Pick<
    IndicativeValuationFiltersDTO,
    "minMarketValue" | "maxMarketValue" | "sortBy" | "sortOrder"
  >,
) {
  const normalizedSortBy = sortFieldMap[filters.sortBy] ?? filters.sortBy;
  const sortField = fallbackSortFields.has(normalizedSortBy)
    ? normalizedSortBy
    : "createdAt";
  const sortOrder = filters.sortOrder ?? Prisma.SortOrder.desc;

  return attachMarketTotals(records)
    .filter((entry) => {
      if (
        filters.minMarketValue !== undefined &&
        entry.minMarketValue < filters.minMarketValue
      ) {
        return false;
      }

      if (
        filters.maxMarketValue !== undefined &&
        entry.maxMarketValue > filters.maxMarketValue
      ) {
        return false;
      }

      return true;
    })
    .sort((left, right) => {
      const primaryComparison = compareValues(
        getSortValue(left, sortField),
        getSortValue(right, sortField),
        sortOrder,
      );

      if (primaryComparison !== 0) {
        return primaryComparison;
      }

      return compareValues(left.record.indicationId, right.record.indicationId, sortOrder);
    })
    .map((entry) => entry.record);
}

export class IndicativeValuationRepository {
  private get componentClient() {
    return prisma.indicativeValuationComponent;
  }

  private async findMatchingRecords(filters: IndicativeValuationFiltersDTO) {
    const where = buildWhere(filters);

    const records = await prisma.propertyIndicativeValuation.findMany({
      where,
      orderBy: { createdAt: Prisma.SortOrder.desc },
      select: indicativeValuationSelect,
    });

    return applyMarketRangeFilterAndSort(records, filters);
  }

  async findAll(filters: IndicativeValuationFiltersDTO) {
    const { page, limit } = filters;
    const skip = (page - 1) * limit;
    const records = await this.findMatchingRecords(filters);
    const total = records.length;

    return {
      total,
      records: records.slice(skip, skip + limit),
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  findForExport(filters: IndicativeValuationFiltersDTO) {
    return this.findMatchingRecords(filters);
  }

  findWithComponents(indicationId: number): Promise<IndicativeValuationWithRelations | null> {
    return prisma.propertyIndicativeValuation.findUnique({
      where: { indicationId },
      select: indicativeValuationSelect,
    });
  }

  findValuation(indicationId: number) {
    return prisma.propertyIndicativeValuation.findUnique({
      where: { indicationId },
      select: {
        indicationId: true,
        workflowStatus: true,
        status: true,
        valuerId: true,
        propertyId: true,
      },
    });
  }

  updateValuation(
    indicationId: number,
    data: Prisma.PropertyIndicativeValuationUpdateInput
  ) {
    return prisma.propertyIndicativeValuation.update({
      where: { indicationId },
      data,
      select: indicativeValuationSelect,
    });
  }

  findByIndicationId(indicationId: number) {
    return this.componentClient.findMany({
      where: { indicationId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  findById(id: number) {
    return this.componentClient.findUnique({ where: { id } });
  }

  create(data: Prisma.IndicativeValuationComponentCreateInput) {
    return this.componentClient.create({ data });
  }

  update(id: number, data: Prisma.IndicativeValuationComponentUpdateInput) {
    return this.componentClient.update({ where: { id }, data });
  }

  delete(id: number) {
    return this.componentClient.delete({ where: { id } });
  }

  deleteByIndicationId(indicationId: number) {
    return this.componentClient.deleteMany({ where: { indicationId } });
  }

  async totalRange(indicationId: number) {
    const result = await this.componentClient.aggregate({
      where: { indicationId },
      _sum: { minValue: true, maxValue: true },
    });

    return {
      minTotal: result._sum.minValue ?? 0,
      maxTotal: result._sum.maxValue ?? 0,
    };
  }

  auditLog(
    tx: Prisma.TransactionClient,
    params: { userId: number; action: string; entityId: number; details?: unknown }
  ) {
    return tx.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: "IndicativeValuation",
        entityId: params.entityId,
        details: params.details ?? {},
      },
    });
  }
}
