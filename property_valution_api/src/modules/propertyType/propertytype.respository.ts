import { prisma } from "../../db/prisma";

export class PropertyTypeRepository {
  findMany(params: any) {
    return prisma.propertyType.findMany(params);
  }

  findUnique(params: any) {
    return prisma.propertyType.findUnique(params);
  }

  findRecordType(params: any) {
    return prisma.recordType.findUnique(params);
  }

  create(params: any) {
    return prisma.propertyType.create(params);
  }

  update(params: any) {
    return prisma.propertyType.update(params);
  }

  delete(params: any) {
    return prisma.propertyType.delete(params);
  }

  deleteManySubtypes(params: any) {
    return prisma.propertySubtype.deleteMany(params);
  }

  deleteManyCurrentUses(params: any) {
    return prisma.propertyTypeCurrentUse.deleteMany(params);
  }

  transaction(ops: any[]) {
    return prisma.$transaction(ops);
  }
}
