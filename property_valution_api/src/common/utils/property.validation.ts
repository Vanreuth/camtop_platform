import { AppError } from "../errors/app.error";
import { CreatePropertyDto } from "../../modules/property/property.dto";
import { prisma } from "../../db/prisma";
import { getUnitTypeOptionsByPropertyType, isUnitTypeAllowedForPropertyType } from "../constants/unitTypes";
import { DIRECT_UNIT_TYPES } from "../constants/propertyTypes";

const validatePropertyData = async (data: CreatePropertyDto) => {
  if (!data.propertyTypeId) {
    throw new AppError("propertyTypeId is required", 400);
  }

  // Validate property type
  const propertyType = await prisma.propertyType.findUnique({
    where: { propertyTypeId: data.propertyTypeId },
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

  if (!propertyType) {
    throw new AppError("Property type not found", 404);
  }

  if (!propertyType.recordType) {
    throw new AppError(
      "Property type does not have an associated record type",
      400
    );
  }

  const recordTypeName = propertyType.recordType?.recordName;

  // ✅ FIX: Only validate property subtype for Land and LandAndBuilding types
  // Building record type uses buildingSubtype instead
  if (data.propertySubtypeId && recordTypeName !== "Building") {
    const validSubtype = propertyType.subtypes?.find(
      (subtype) => subtype.propertySubtypeId === data.propertySubtypeId
    );

    if (!validSubtype) {
      throw new AppError(
        `Invalid property subtype for ${propertyType.propertyName}. Please select a valid subtype.`,
        400
      );
    }
  }

  // Validate current use belongs to property type
  if (data.currentUseId) {
    const validCurrentUse = propertyType.currentUses?.find(
      (currentUse) => currentUse.useId === data.currentUseId
    );
    if (!validCurrentUse) {
      throw new AppError(
        `Invalid current use for ${propertyType.propertyName}. Please select a valid current use.`,
        400
      );
    }
  }

  const unitTypeOptions = getUnitTypeOptionsByPropertyType(data.propertyTypeId);
  if (unitTypeOptions.length > 0) {
    const directUnits = data.buildingUnit ?? [];
    const nestedUnits = (data.building ?? []).flatMap((b) => b.units ?? []);
    const allUnits = [...directUnits, ...nestedUnits];

    for (const unit of allUnits) {
      if (!unit.unitType) {
        throw new AppError(
          `unitType is required for property type ${propertyType.propertyName}`,
          400
        );
      }

      if (
        unit.propertyTypeId !== undefined &&
        unit.propertyTypeId !== data.propertyTypeId
      ) {
        throw new AppError(
          `unit.propertyTypeId must match propertyTypeId (${data.propertyTypeId})`,
          400
        );
      }

      if (!isUnitTypeAllowedForPropertyType(data.propertyTypeId, unit.unitType)) {
        const allowed = unitTypeOptions.map((u) => u.value).join(", ");
        throw new AppError(
          `Invalid unitType '${unit.unitType}' for ${propertyType.propertyName}. Allowed: ${allowed}`,
          400
        );
      }
    }
  }

  switch (recordTypeName) {
    case "Land":
      if (!data.land) {
        throw new AppError("Land data is required for RecordType: Land", 400);
      }
      if (data.building && data.building.length > 0) {
        throw new AppError("RecordType: Land cannot have building data", 400);
      }
      break;

    case "Building":
      const isDirectUnitType = DIRECT_UNIT_TYPES.includes(
        data.propertyTypeId as (typeof DIRECT_UNIT_TYPES)[number]
      );

      if (isDirectUnitType) {
        const hasDirectUnits = (data.buildingUnit?.length ?? 0) > 0;
        const hasNestedUnits = (data.building ?? []).some(
          (b) => (b.units?.length ?? 0) > 0
        );

        if (!hasDirectUnits && !hasNestedUnits) {
          throw new AppError(
            "At least one unit is required for Residential/Commercial Building property types",
            400
          );
        }
      } else if (!data.building || data.building.length === 0) {
        throw new AppError(
          "Building data with at least one building is required for RecordType: Building",
          400
        );
      }

      // ✅ Only validate buildingSubtypeId if NOT a direct unit type
      // Direct unit types (Residential/Commercial Buildings) don't need a building record
      if (!isDirectUnitType) {
        for (const b of data.building) {
          if (!b.buildingSubtypeId) {
            throw new AppError(
              "Each building must have a buildingSubtypeId",
              400
            );
          }

          const buildingSubtype = await prisma.buildingSubtype.findUnique({
            where: { buildingSubtypeId: b.buildingSubtypeId },
          });

          if (!buildingSubtype) {
            throw new AppError(
              `Building subtype with ID ${b.buildingSubtypeId} not found`,
              404
            );
          }
        }
      }

      // ✅ Building record type should NOT have land data
      if (data.land) {
        throw new AppError("RecordType: Building cannot have land data", 400);
      }
      if (data.agricultureLand) {
        throw new AppError(
          "RecordType: Building cannot have agricultureLand",
          400
        );
      }
      break;

    case "LandAndBuilding":
      if (!data.land || !data.building) {
        throw new AppError(
          "Both land and building data are required for RecordType: LandAndBuilding",
          400
        );
      }
      if (!data.building || data.building.length === 0) {
        throw new AppError(
          "Building data is required for RecordType: LandAndBuilding",
          400
        );
      }

      // Validate building subtypes for LandAndBuilding
      for (const b of data.building) {
        if (!b.buildingSubtypeId) {
          throw new AppError(
            "Each building must have a buildingSubtypeId",
            400
          );
        }

        const buildingSubtype = await prisma.buildingSubtype.findUnique({
          where: { buildingSubtypeId: b.buildingSubtypeId },
        });

        if (!buildingSubtype) {
          throw new AppError(
            `Building subtype with ID ${b.buildingSubtypeId} not found for LandAndBuilding record type.`,
            404
          );
        }
      }
      break;

    default:
      throw new AppError(
        `Invalid or unsupported RecordType: ${recordTypeName}`,
        400
      );
  }

  return {
    propertyType,
  };
};

export { validatePropertyData };
