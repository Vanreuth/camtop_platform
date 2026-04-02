import {
  CreatePropertyTypeDto,
  UpdatePropertyTypeDto,
} from "./propertyType.dto";
import { NotFoundError } from "../../common/errors/notFound.error";
import { PropertyTypeRepository } from "./propertytype.respository";

const repository = new PropertyTypeRepository();

const getAllPropertyTypes = async () => {
  return await repository.findMany({
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
  });
};

const getPropertyTypeById = async (id: number) => {
  const propertyType = await repository.findUnique({
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
  });

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
  return await repository.create({
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
};

const updatePropertyType = async (
  propertyTypeId: number,
  data: UpdatePropertyTypeDto
) => {
  const existingPropertyType = await repository.findUnique({
    where: { propertyTypeId },
    include: { currentUses: true, subtypes: true },
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

  // Clear old relations first to avoid duplicates.
  await repository.deleteManyCurrentUses({
    where: { propertyTypeId },
  });

  await repository.deleteManySubtypes({
    where: { propertyTypeId },
  });

  return await repository.update({
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
  });
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

  return { message: "Property type deleted successfully" };
};

export const propertyTypeService = {
  createPropertyType,
  updatePropertyType,
  getAllPropertyTypes,
  getPropertyTypeById,
  deletePropertyType,
};
