export interface UnitTypeOption {
  value: string;
  label: string;
}

const uniqueByValue = (options: UnitTypeOption[]): UnitTypeOption[] => {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
};

const RESIDENTIAL_BUILDING_UNIT_TYPES: UnitTypeOption[] = [
  { value: "STUDIO", label: "Studio" },
  { value: "ONE_BEDROOM", label: "1 Bedroom" },
  { value: "TWO_BEDROOM", label: "2 Bedrooms" },
  { value: "THREE_BEDROOM", label: "3 Bedrooms" },
  { value: "PENTHOUSE", label: "Penthouse" },
  { value: "DUPLEX", label: "Duplex" },
  { value: "APARTMENT", label: "Apartment" },
];

const COMMERCIAL_UNIT_TYPES: UnitTypeOption[] = [
  { value: "OFFICE", label: "Office" },
  { value: "RETAIL", label: "Retail" },
  { value: "SHOWROOM", label: "Showroom" },
  { value: "MIXED_USE", label: "Mixed Use" },
  { value: "WAREHOUSE", label: "Warehouse" },
];

const INDUSTRIAL_UNIT_TYPES: UnitTypeOption[] = [
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "FACTORY", label: "Factory" },
  { value: "STORAGE", label: "Storage" },
];

const SPECIALIZED_UNIT_TYPES: UnitTypeOption[] = [
  { value: "OFFICE", label: "Office" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "WAREHOUSE", label: "Warehouse" },
];

const DEFAULT_UNIT_TYPES: UnitTypeOption[] = [
  ...RESIDENTIAL_BUILDING_UNIT_TYPES,
  ...COMMERCIAL_UNIT_TYPES,
  ...INDUSTRIAL_UNIT_TYPES,
];

export const UNIT_TYPE_OPTIONS_BY_PROPERTY_TYPE: Record<number, UnitTypeOption[]> = {
  3: RESIDENTIAL_BUILDING_UNIT_TYPES, // Residential Building
  4: COMMERCIAL_UNIT_TYPES, // Commercial Building
  6: RESIDENTIAL_BUILDING_UNIT_TYPES, // Residential Property
  7: COMMERCIAL_UNIT_TYPES, // Commercial Property
  8: INDUSTRIAL_UNIT_TYPES, // Industrial Property
  9: SPECIALIZED_UNIT_TYPES, // Specialized Property
};

export const DEFAULT_UNIT_TYPE_OPTIONS = uniqueByValue(DEFAULT_UNIT_TYPES);

export const getUnitTypeOptions = (
  propertyTypeId?: number | string | null
): UnitTypeOption[] => {
  if (propertyTypeId === null || propertyTypeId === undefined) {
    return DEFAULT_UNIT_TYPE_OPTIONS;
  }

  const id =
    typeof propertyTypeId === "string"
      ? parseInt(propertyTypeId, 10)
      : propertyTypeId;

  if (Number.isNaN(id)) return DEFAULT_UNIT_TYPE_OPTIONS;

  return uniqueByValue(
    UNIT_TYPE_OPTIONS_BY_PROPERTY_TYPE[id] ?? DEFAULT_UNIT_TYPE_OPTIONS
  );
};
