import {
  CreatePropertyTypeDto,
  UpdatePropertyTypeDto,
} from "./propertyType.dto";
import config from "../../config";
import { NotFoundError } from "../../common/errors/notFound.error";
import { cacheService } from "../../services/cache/cache.service";
import { cacheKeys } from "../../services/cache/cacheKeys";
import { PropertyTypeRepository } from "./propertytype.respository";

const repository = new PropertyTypeRepository();

const getAllPropertyTypes = async () => {
  return await cacheService.getOrSetJson(
    cacheKeys.propertyType.all,
    config.redis.propertyTypeTtlSeconds,
    () =>
      repository.findMany({
        include: {
          subtypes: true,
          recordType: true,
          currentUses: {
            include: {
              currentUse: true,
            },
          },
          _count: {
            select: {
              properties: true,
            },
          },
        },
        orderBy: {
          propertyName: "asc",
        },
      })
  );
};

const getPropertyTypeById = async (id: number) => {
  const propertyType = await cacheService.getOrSetJson(
    cacheKeys.propertyType.byId(id),
    config.redis.propertyTypeTtlSeconds,
    () =>
      repository.findUnique({
        where: { propertyTypeId: id },
        include: {
          recordType: true,
          currentUses: {
            include: {
              currentUse: true,
            },
          },
          subtypes: true,
          buildingSubtypes: true,
        },
      })
  );

  if (!propertyType) {
    throw new NotFoundError(`Property type with ID ${id} not found`);
  }

  return propertyType;
};

const createPropertyType = async (data: CreatePropertyTypeDto) => {
  const recordType = await repository.findRecordType({
    where: { recordTypeId: data.recordTypeId },
  });
  if (!recordType) {
    throw new Error("Record type not found");
  }
  const createdPropertyType = await repository.create({
    data: {
      propertyName: data.propertyTypeName,
      recordTypeId: data.recordTypeId,
      ...(data.subtypeName &&
        data.subtypeName.length > 0 && {
          subtypes: {
            create: data.subtypeName.map((name) => ({
              subtypeName: name,
            })),
          },
        }),
      ...(data.currentUseId &&
        data.currentUseId.length > 0 && {
          currentUses: {
            create: data.currentUseId.map((useId) => ({
              useId,
            })),
          },
        }),
    },

    include: {
      recordType: true,
      subtypes: true,
      currentUses: {
        include: {
          currentUse: true,
        },
      },
    },
  });

  await cacheService.delete(cacheKeys.propertyType.all);

  return createdPropertyType;
};

const updatePropertyType = async (
  propertyTypeId: number,
  data: UpdatePropertyTypeDto
) => {
  const existingPropertyType = await repository.findUnique({
    where: { propertyTypeId },
    select: { propertyTypeId: true },
  });

  if (!existingPropertyType) {
    throw new NotFoundError(
      `Property type with ID ${propertyTypeId} not found`
    );
  }

  // Optional recordTypeId validation
  if (data.recordTypeId) {
    const recordType = await repository.findRecordType({
      where: { recordTypeId: data.recordTypeId },
    });

    if (!recordType) {
      throw new NotFoundError(
        `Record type with ID ${data.recordTypeId} not found`
      );
    }
  }

  const updatedPropertyType = await repository.transaction([
    repository.deleteManyCurrentUses({
      where: { propertyTypeId },
    }),
    repository.deleteManySubtypes({
      where: { propertyTypeId },
    }),
    repository.update({
      where: { propertyTypeId },
      data: {
        propertyName: data.propertyTypeName,
        ...(data.recordTypeId && {
          recordType: {
            connect: { recordTypeId: data.recordTypeId },
          },
        }),
        ...(data.subtypeName &&
          data.subtypeName.length > 0 && {
            subtypes: {
              create: data.subtypeName.map((name) => ({ subtypeName: name })),
            },
          }),
        ...(data.currentUseId &&
          data.currentUseId.length > 0 && {
            currentUses: {
              create: data.currentUseId.map((useId) => ({ useId })),
            },
          }),
      },
      include: {
        recordType: true,
        subtypes: true,
        currentUses: {
          include: {
            currentUse: true,
          },
        },
      },
    }),
  ]).then(([, , result]) => result);

  await cacheService.deleteMany([
    cacheKeys.propertyType.all,
    cacheKeys.propertyType.byId(propertyTypeId),
  ]);

  return updatedPropertyType;
};

const deletePropertyType = async (id: number) => {
  const existingPropertyType = await repository.findUnique({
    where: { propertyTypeId: id },
  });

  if (!existingPropertyType) {
    throw new NotFoundError(`Property type with ID ${id} not found`);
  }

  await repository.transaction([
    repository.deleteManySubtypes({ where: { propertyTypeId: id } }),
    repository.deleteManyCurrentUses({ where: { propertyTypeId: id } }),
    repository.delete({ where: { propertyTypeId: id } }),
  ]);

  await cacheService.deleteMany([
    cacheKeys.propertyType.all,
    cacheKeys.propertyType.byId(id),
  ]);

  return { message: "Property type deleted successfully" };
};

export const propertyTypeService = {
  createPropertyType,
  updatePropertyType,
  getAllPropertyTypes,
  getPropertyTypeById,
  deletePropertyType,
};
