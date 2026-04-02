import { UnitType } from "@prisma/client";
import { PROPERTY_TYPES } from "./propertyTypes";

export type UnitTypeOption = {
  value: UnitType;
  label: string;
};

export const RESIDENTIAL_UNIT_TYPES: UnitTypeOption[] = [
  { value: UnitType.STUDIO, label: "Studio" },
  { value: UnitType.ONE_BEDROOM, label: "1 Bedroom" },
  { value: UnitType.TWO_BEDROOM, label: "2 Bedrooms" },
  { value: UnitType.THREE_BEDROOM, label: "3 Bedrooms" },
  { value: UnitType.PENTHOUSE, label: "Penthouse" },
  { value: UnitType.DUPLEX, label: "Duplex" },
  { value: UnitType.APARTMENT, label: "Apartment" },
];

export const COMMERCIAL_UNIT_TYPES: UnitTypeOption[] = [
  { value: UnitType.OFFICE, label: "Office" },
  { value: UnitType.RETAIL, label: "Retail" },
  { value: UnitType.SHOWROOM, label: "Showroom" },
  { value: UnitType.MIXED_USE, label: "Mixed Use" },
  { value: UnitType.WAREHOUSE, label: "Warehouse" },
];

export const INDUSTRIAL_UNIT_TYPES: UnitTypeOption[] = [
  { value: UnitType.WAREHOUSE, label: "Warehouse" },
  { value: UnitType.FACTORY, label: "Factory" },
  { value: UnitType.STORAGE, label: "Storage" },
];

export const SPECIALIZED_UNIT_TYPES: UnitTypeOption[] = [
  { value: UnitType.OFFICE, label: "Office" },
  { value: UnitType.APARTMENT, label: "Apartment" },
  { value: UnitType.WAREHOUSE, label: "Warehouse" },
];

const PROPERTY_TYPE_UNIT_TYPES: Partial<Record<number, UnitTypeOption[]>> = {
  [PROPERTY_TYPES.RESIDENTIAL_BUILDING]: RESIDENTIAL_UNIT_TYPES,
  [PROPERTY_TYPES.COMMERCIAL_BUILDING]: COMMERCIAL_UNIT_TYPES,
  [PROPERTY_TYPES.INDUSTRIAL_PROPERTY]: INDUSTRIAL_UNIT_TYPES,
  [PROPERTY_TYPES.SPECIALIZED_PROPERTY]: SPECIALIZED_UNIT_TYPES,
};

export const getUnitTypeOptionsByPropertyType = (propertyTypeId: number): UnitTypeOption[] =>
  PROPERTY_TYPE_UNIT_TYPES[propertyTypeId] ?? [];

export const isUnitTypeAllowedForPropertyType = (
  propertyTypeId: number,
  unitType: UnitType
): boolean => getUnitTypeOptionsByPropertyType(propertyTypeId).some((u) => u.value === unitType);
