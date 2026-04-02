
import type { PhysicalCondition } from "@/utils/physicalCondition";

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
  diningroom: string; // NEW
  totalRoom: string;
  parkingSpace: string;
  constructionYear: string;
  effectiveAge: string;
  usefulLife: string;
  costPerSqm: string;
  replacementCostPerSqm: string; // NEW - for valuation calculations
  totalBuildingCost: string; // NEW
  percentageOfConstruction: string | number;
  viewType: string;
  status: string;
  totalUnits: string;
  units: UnitData[];
}

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
  replacementCostPerSqm: string; // NEW
  totalBuildingCost: string; // NEW
  physical_condition: PhysicalCondition | "";
  managementFee: string;
  viewType: string;
}
