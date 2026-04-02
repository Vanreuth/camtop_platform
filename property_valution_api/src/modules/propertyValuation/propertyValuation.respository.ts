import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { valuationFiltersDTO } from "./propertyValuation.dto";

type PropertyValuationGroupByArgs =
  Parameters<PrismaClient["propertyValuation"]["groupBy"]>[0];

export class PropertyValuationRepository {
  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? prisma;
  }

  transaction<T>(handler: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(handler);
  }

  // ---------------- Property ----------------
  findProperty(params: Prisma.PropertyFindUniqueArgs, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).property.findUnique(params);
  }

  findPropertyType(
    params: Prisma.PropertyTypeFindUniqueArgs,
    tx?: Prisma.TransactionClient
  ) {
    return this.getClient(tx).propertyType.findUnique(params);
  }

  createProperty(params: Prisma.PropertyCreateArgs, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).property.create(params);
  }

  updateProperty(params: Prisma.PropertyUpdateArgs, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).property.update(params);
  }

  // ---------------- Valuation ----------------
  findUnique(params: Prisma.PropertyValuationFindUniqueArgs, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).propertyValuation.findUnique(params);
  }

  findFirst(params: Prisma.PropertyValuationFindFirstArgs, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).propertyValuation.findFirst(params);
  }

  findMany(params: Prisma.PropertyValuationFindManyArgs, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).propertyValuation.findMany(params);
  }

  create(params: Prisma.PropertyValuationCreateArgs, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).propertyValuation.create(params);
  }

  update(params: Prisma.PropertyValuationUpdateArgs, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).propertyValuation.update(params);
  }

  updateMany(params: Prisma.PropertyValuationUpdateManyArgs, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).propertyValuation.updateMany(params);
  }

  count(where: Prisma.PropertyValuationWhereInput, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).propertyValuation.count({ where });
  }

  aggregate(params: Prisma.PropertyValuationAggregateArgs, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).propertyValuation.aggregate(params);
  }

  groupBy(params: PropertyValuationGroupByArgs, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).propertyValuation.groupBy(params);
  }

  // ---------------- Documents ----------------
  createDocument(params: Prisma.ValuationDocumentCreateArgs, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).valuationDocument.create(params);
  }

  findLatestDocument(
    args: Prisma.ValuationDocumentFindFirstArgs,
    tx?: Prisma.TransactionClient
  ) {
    const callerOrder = Array.isArray(args.orderBy) ? args.orderBy : (args.orderBy ? [args.orderBy] : []);
    return this.getClient(tx).valuationDocument.findFirst({
      ...args,
      orderBy: [{ version: "desc" }, ...callerOrder],
    });
  }

  findDocumentById(
    args: { valuationId: number; version: number },
    tx?: Prisma.TransactionClient
  ) {
    return this.getClient(tx).valuationDocument.findFirst({
      where: { valuationId: args.valuationId, version: args.version },
    });
  }

  findLatestValuationDocumentId(valuationId: number, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).valuationDocument.findFirst({
      where: { valuationId },
      orderBy: { version: "desc" },
    });
  }

  findValuationBasic(valuationId: number, tx?: Prisma.TransactionClient) {
    return this.getClient(tx).propertyValuation.findUnique({
      where: { valuationId },
      select: {
        valuationId: true,
        valuationNo: true,
        propertyId: true,
        valuationDate: true,
        status: true,
      },
    });
  }

  // ---------------- Export ----------------
  findSingleValuationForExport(client: PrismaClient, valuationId: number) {
    return client.propertyValuation.findUnique({
      where: { valuationId },
      include: {
        property: {
          include: {
            propertyType: true,
            propertyAddress: { include: { province: true, district: true, commune: true } },
            propertyLocation: true,
          },
        },
        valuer: { select: { id: true, username: true, firstName: true, lastName: true } },
        documents: { orderBy: { version: "desc" } },
        lastestDocument: true,
      },
    });
  }

  // ---------------- updateWhere (safe) ----------------
  async updateWhere(
    args: { where: Prisma.PropertyValuationWhereInput; data: Prisma.PropertyValuationUpdateManyMutationInput },
    tx?: Prisma.TransactionClient
  ) {
    const client = this.getClient(tx);

    const r = await client.propertyValuation.updateMany({
      where: args.where,
      data: args.data,
    });

    if (r.count === 0) return null;

    // If caller uses unique key in where, we can fetch it.
    // Otherwise, return the first updated record.
    const maybeId = (args.where as any)?.valuationId;
    if (typeof maybeId === "number") {
      return client.propertyValuation.findUnique({ where: { valuationId: maybeId } });
    }

    return client.propertyValuation.findFirst({ where: args.where });
  }

  // ---------------- Filters builder (FIXED) ----------------
  buildValuationWhere = (filter: valuationFiltersDTO): Prisma.PropertyValuationWhereInput => {
    const { search, ...filterOptions } = filter;
    const conditions: Prisma.PropertyValuationWhereInput[] = [];

    // 1) Global Search
    if (search?.trim()) {
      conditions.push({
        OR: [
          { valuationNo: { contains: search, mode: "insensitive" } },
          // property relation (safer with is)
          { property: { is: { propertyName: { contains: search, mode: "insensitive" } } } },
          { property: { is: { propertyCode: { contains: search, mode: "insensitive" } } } },
          {
            property: {
              is: {
                dataSource: {
                  is: {
                    contactName: { contains: search, mode: "insensitive" },
                  },
                },
              },
            },
          },
          {
            property: {
              is: {
                dataSource: {
                  is: {
                    phoneNumber: { contains: search, mode: "insensitive" },
                  },
                },
              },
            },
          },
          { valuer: { username: { contains: search, mode: "insensitive" } } },
          { valuer: { firstName: { contains: search, mode: "insensitive" } } },
          { valuer: { lastName: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    // 2) Exact filters
    if (filterOptions.propertyId != null) conditions.push({ propertyId: filterOptions.propertyId });
    if (filterOptions.valuationMethod) conditions.push({ valuationMethod: filterOptions.valuationMethod });
    if (filterOptions.valuerId != null) conditions.push({ valuerId: Number(filterOptions.valuerId) });
    if (filterOptions.approvedById != null) conditions.push({ approvedBy: Number(filterOptions.approvedById) });
    if (filterOptions.preparedFor?.trim()) conditions.push({ preparedFor: filterOptions.preparedFor.trim() });
    if (filterOptions.purposeOfValuation?.trim()) {
      conditions.push({ purposeOfValuation: filterOptions.purposeOfValuation.trim() });
    }

    // 3) Property specifics
    if (filterOptions.propertyName?.trim()) {
      conditions.push({
        property: { is: { propertyName: { contains: filterOptions.propertyName, mode: "insensitive" } } },
      });
    }
    if (filterOptions.propertyTypeId != null) {
      conditions.push({
        property: { is: { propertyTypeId: Number(filterOptions.propertyTypeId) } },
      });
    }

    // 4) Location hierarchy (Address) ✅ FIX: use is/is
    if (filter.provinceId || filter.districtId || filter.communeId || filter.villageId) {
      conditions.push({
        property: {
          is: {
            propertyAddress: {
              is: {
                ...(filter.provinceId && { provinceId: filter.provinceId }),
                ...(filter.districtId && { districtId: filter.districtId }),
                ...(filter.communeId && { communeId: filter.communeId }),
                ...(filter.villageId && { villageId: filter.villageId }),
              },
            },
          },
        },
      });
    }

    // 5) Numeric ranges (Market Value) ✅ FIX: allow 0
    const hasMin = filterOptions.minValue != null;
    const hasMax = filterOptions.maxValue != null;
    if (hasMin || hasMax) {
      conditions.push({
        marketValue: {
          ...(hasMin && { gte: filterOptions.minValue }),
          ...(hasMax && { lte: filterOptions.maxValue }),
        },
      });
    }

    // 6) Date ranges
    if (filterOptions.valuationDateFrom || filterOptions.valuationDateTo) {
      conditions.push({
        valuationDate: {
          ...(filterOptions.valuationDateFrom && { gte: filterOptions.valuationDateFrom }),
          ...(filterOptions.valuationDateTo && { lte: filterOptions.valuationDateTo }),
        },
      });
    }

    // 7) Status and WorkflowStatus
    if (filterOptions.status) {
      conditions.push({ status: filterOptions.status });
    }
    if (filterOptions.workflowStatus) {
      conditions.push({ workflowStatus: filterOptions.workflowStatus });
    } else {
      // Exclude ARCHIVED by default using 'not in' operator
      conditions.push({ workflowStatus: { notIn: ["ARCHIVED"] } });
    }

    return { AND: conditions };
  };
}
