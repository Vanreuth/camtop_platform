import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { IndicativeValuationFiltersDTO } from "./indicativeValuation.dto";

export const indicativeInclude = {
  property: {
    include: {
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
    },
  },
  valuer: {
    select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
  },
  approvedUser: {
    select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
  },
  rejectedUser: {
    select: { id: true, username: true, firstName: true, lastName: true, profilePicture: true },
  },
  createdByUser: {
    select: { id: true, username: true, firstName: true, lastName: true },
  },
  updatedByUser: {
    select: { id: true, username: true, firstName: true, lastName: true },
  },
  components: {
    orderBy: [
      { sortOrder: Prisma.SortOrder.asc },
      { id: Prisma.SortOrder.asc },
    ],
  },
} satisfies Prisma.PropertyIndicativeValuationInclude;

export type IndicativeValuationWithRelations = Prisma.PropertyIndicativeValuationGetPayload<{
  include: typeof indicativeInclude;
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
  minMarketValue: "minValue",
  maxMarketValue: "maxValue",
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
  "minValue",
  "maxValue",
]);

export class IndicativeValuationRepository {
  private get componentClient() {
    return prisma.indicativeValuationComponent;
  }

  async findAll(filters: IndicativeValuationFiltersDTO) {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      propertyTypeId,
      provinceId,
      districtId,
      communeId,
      villageId,
      minMarketValue,
      maxMarketValue,
      createdAfter,
      createdBefore,
      ...rest
    } = filters;
    const skip = (page - 1) * limit;
    const normalizedSortBy = sortFieldMap[sortBy] ?? sortBy;
    const orderByField = fallbackSortFields.has(normalizedSortBy)
      ? normalizedSortBy
      : "createdAt";

    const propertyFilters: Prisma.PropertyWhereInput = {
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

    const where: Prisma.PropertyIndicativeValuationWhereInput = {
      ...(rest.propertyId && { propertyId: rest.propertyId }),
      ...(rest.valuerId && { valuerId: rest.valuerId }),
      ...(rest.status && { status: rest.status }),
      ...(rest.workflowStatus && { workflowStatus: rest.workflowStatus }),
      ...((rest.instructedBy || rest.preparedFor)
        ? { instructedBy: rest.instructedBy ?? rest.preparedFor }
        : {}),
      ...((rest.intendedUse || rest.purposeOfValuation)
        ? { intendedUse: rest.intendedUse ?? rest.purposeOfValuation }
        : {}),
      ...(Object.keys(propertyFilters).length > 0
        ? {
            property: {
              is: propertyFilters,
            },
          }
        : {}),
      ...(minMarketValue !== undefined
        ? {
            minValue: {
              gte: minMarketValue,
            },
          }
        : {}),
      ...(maxMarketValue !== undefined
        ? {
            maxValue: {
              lte: maxMarketValue,
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

    const [total, records] = await prisma.$transaction([
      prisma.propertyIndicativeValuation.count({ where }),
      prisma.propertyIndicativeValuation.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [orderByField]: sortOrder,
        } as Prisma.PropertyIndicativeValuationOrderByWithRelationInput,
        include: indicativeInclude,
      }),
    ]);

    return { total, records, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findWithComponents(indicationId: number): Promise<IndicativeValuationWithRelations | null> {
    return prisma.propertyIndicativeValuation.findUnique({
      where: { indicationId },
      include: indicativeInclude,
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
      include: indicativeInclude,
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
