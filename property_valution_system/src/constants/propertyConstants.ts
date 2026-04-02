// Property Type ID Constants
export const PROPERTY_TYPE_IDS = {
  VACANT_LAND: 1,
  AGRICULTURAL_LAND: 2,
  RESIDENTIAL_BUILDING: 3, // Units (Condo/Apartment)
  COMMERCIAL_BUILDING: 4, // Units (Office/Retail)
  AGRICULTURAL_PROPERTY: 5,
  RESIDENTIAL_PROPERTY: 6, // House with Land
  COMMERCIAL_PROPERTY: 7, // Shophouse, Hotel, etc.
  INDUSTRIAL_PROPERTY: 8,
  SPECIALIZED_PROPERTY: 9,
} as const;

// Default Address Codes
export const DEFAULT_ADDRESS_CODES = {
  provinceId: null,
  districtId: null,
  communeId: null,
  villageId: null,
} as const;
