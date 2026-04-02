import type { PhysicalCondition } from "@/utils/physicalCondition";

export interface UnitData {
  unitNo: string;
  unitType: string;
  floorNo: string;
  floorAreaSqm: string;
  totalAreaSqm: string;
  numberOfBedrooms: string;
  numberOfBathrooms: string;
  hasKitchen: boolean;
  hasLivingRoom: boolean;
  hasParkingSpace: boolean;
  constructedYear: string;
  usefulLife: string;
  effectiveAge: string;
  costPerSqm: string;
  replacementCostPerSqm: string;
  totalBuildingCost: string;
  physical_condition: PhysicalCondition | "";
  managementFee: string;
  viewType: string;
}

export interface BuildingData {
  buildingName: string;
  buildingSubtypeId: string;
  width: string;
  length: string;
  numberOfStorey: string;
  grossAreaSqm: string;
  bedroom: string;
  bathroom: string;
  livingroom: string;
  kitchen: string;
  diningroom: string;
  totalRoom: string;
  parkingSpace: string;
  constructionYear: string;
  effectiveAge: string;
  usefulLife: string;
  costPerSqm: string;
  replacementCostPerSqm: string;
  totalBuildingCost: string;
  percentageOfConstruction: string | number;
  viewType: string;
  status: string;
  totalUnits: string;
  units: UnitData[];
}

export interface PropertyFormData {
  propertyName: string;
  propertyTypeId: string;
  propertySubtypeId: string;
  currentUseId: string;
  status: string;
  description: string;
  // Address
  provinceId: string;
  districtId: string;
  communeId: string;
  villageId: string;
  street: string;
  houseNo: string;
  latitude: string;
  longitude: string;
  formattedAddress: string;
  placeId: string;
  // Land
  widthMeters: string;
  lengthMeters: string;
  landAreaSqm: string;
  landShape: string;
  topography: string;
  sitePosition: string;
  waterSource: string;
  // Agri
  typeofTree: string;
  numberOfTrees: string;
  ageOfTrees: string;
  // Buildings
  buildings: BuildingData[];
  // Docs & Transaction
  titleDeedType: string;
  titleDeedNo: string;
  issuedYear: string;
  parcelNo: string;
  totalSizeByTitleDeed: string;
  sourceType: string;
  contactName: string;
  phoneNumber: string;
  transactionType: string;
  transactionDate: string;
  totalPrice: string;
}
