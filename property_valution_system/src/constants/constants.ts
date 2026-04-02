const PROPERTY_TYPE_IDS = {
  VACANT_LAND: 1,
  AGRICULTURAL_LAND: 2,
  RESIDENTIAL_BUILDING: 3,
  COMMERCIAL_BUILDING: 4,
  AGRICULTURAL_PROPERTY: 5,
  RESIDENTIAL_PROPERTY: 6,
  COMMERCIAL_PROPERTY: 7,
  INDUSTRIAL_PROPERTY: 8,
  SPECIALIZED_PROPERTY: 9,
};

const PROPERTY_TYPES = [
  {
    propertyTypeId: 1,
    propertyName: "Vacant Land",
    recordTypeId: 1,
    recordType: { recordTypeId: 1, recordName: "Land" },
    subtypes: [
      { propertySubtypeId: 1, subtypeName: "Improvement Land" },
      { propertySubtypeId: 2, subtypeName: "Unimprovement Land" },
    ],
    currentUses: [
      { useId: 23, currentUse: { useId: 23, useName: "Vacant Land" } },
      { useId: 24, currentUse: { useId: 24, useName: "Development Land" } },
    ],
  },
  {
    propertyTypeId: 3,
    propertyName: "Residential Building",
    recordTypeId: 2,
    recordType: { recordTypeId: 2, recordName: "Building" },
    subtypes: [
      { propertySubtypeId: 22, subtypeName: "Condominium" },
      { propertySubtypeId: 23, subtypeName: "Apartment" },
    ],
    currentUses: [
      { useId: 3, currentUse: { useId: 3, useName: "Condominium" } },
      { useId: 4, currentUse: { useId: 4, useName: "Apartment Building" } },
    ],
    buildingSubtypes: [
      { buildingSubtypeId: 2, subtypeName: "Condominium Unit" },
      { buildingSubtypeId: 3, subtypeName: "Apartment Unit" },
    ],
  },
  {
    propertyTypeId: 6,
    propertyName: "Residential Property",
    recordTypeId: 3,
    recordType: { recordTypeId: 3, recordName: "Land & Building" },
    subtypes: [
      { propertySubtypeId: 48, subtypeName: "Villa" },
      { propertySubtypeId: 49, subtypeName: "Dwelling House" },
    ],
    currentUses: [
      { useId: 1, currentUse: { useId: 1, useName: "Single Family Residential" } },
      { useId: 2, currentUse: { useId: 2, useName: "Multi-Family Residential" } },
    ],
    buildingSubtypes: [
      { buildingSubtypeId: 19, subtypeName: "Dwelling House" },
      { buildingSubtypeId: 20, subtypeName: "Linked House" },
    ],
  },
];

export { PROPERTY_TYPE_IDS, PROPERTY_TYPES };