// Property Calculation Utilities

export function parseConstructionPercentage(value: string | number): number {
  if (typeof value === "number") {
    return value > 1 ? value / 100 : value;
  }
  switch (value) {
    case "TEN_PERCENT":
      return 0.1;
    case "TWENTY_PERCENT":
      return 0.2;
    case "THIRTY_PERCENT":
      return 0.3;
    case "FORTY_PERCENT":
      return 0.4;
    case "FIFTY_PERCENT":
      return 0.5;
    case "SIXTY_PERCENT":
      return 0.6;
    case "SEVENTY_PERCENT":
      return 0.7;
    case "EIGHTY_PERCENT":
      return 0.8;
    case "NINETY_PERCENT":
      return 0.9;
    case "FULLY_COMPLETED":
      return 1.0;
    default: {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return value.includes("%") || num > 1 ? num / 100 : num;
      }
      return 1.0;
    }
  }
}

export interface ResidualCalculationResult {
  newBuildingCost: number;
  depreciationRatio: number;
  depreciationAmount: number;
  currentBuildingValue: number;
  residualLandValue: number;
  landPricePerSqm: number;
  totalPrice: number;
  buildingPercentage: number;
  landPercentage: number;
}

export interface ResidualBuildingInput {
  grossAreaSqm: number;
  replacementCostPerSqm: number;
  constructionPercentage: number;
  effectiveAge: number;
  usefulLife: number;
}

export class ResidualMethodCalculator {
  static calculate(
    transactionPrice: number,
    buildingData: ResidualBuildingInput | ResidualBuildingInput[],
    landAreaSqm: number,
    totalSizeByTitleDeed: number
  ): ResidualCalculationResult {
    const buildings = Array.isArray(buildingData)
      ? buildingData
      : [buildingData];

    const totals = buildings.reduce(
      (acc, building) => {
        const constructionFactor =
          building.constructionPercentage > 1
            ? building.constructionPercentage / 100
            : building.constructionPercentage;

        const safeUsefulLife = building.usefulLife > 0 ? building.usefulLife : 0;
        const safeDepreciationRatio =
          safeUsefulLife > 0 ? building.effectiveAge / safeUsefulLife : 0;

        const buildingNewCost =
          building.grossAreaSqm *
          building.replacementCostPerSqm *
          constructionFactor;
        const buildingDepreciation = buildingNewCost * safeDepreciationRatio;

        acc.newBuildingCost += buildingNewCost;
        acc.depreciationAmount += buildingDepreciation;
        return acc;
      },
      { newBuildingCost: 0, depreciationAmount: 0 }
    );

    const newBuildingCost = totals.newBuildingCost;
    const depreciationAmount = totals.depreciationAmount;
    const depreciationRatio =
      newBuildingCost > 0 ? depreciationAmount / newBuildingCost : 0;
    const currentBuildingValue = newBuildingCost - depreciationAmount;

    const residualLandValue = transactionPrice - currentBuildingValue;

    const areaForCalculation =
      totalSizeByTitleDeed > 0 ? totalSizeByTitleDeed : landAreaSqm;

    const landPricePerSqm =
      areaForCalculation > 0 ? residualLandValue / areaForCalculation : 0;

    const buildingPercentage =
      transactionPrice > 0 ? (currentBuildingValue / transactionPrice) * 100 : 0;
    const landPercentage =
      transactionPrice > 0 ? (residualLandValue / transactionPrice) * 100 : 0;

    return {
      newBuildingCost: parseFloat(newBuildingCost.toFixed(2)),
      depreciationRatio: parseFloat(depreciationRatio.toFixed(4)),
      depreciationAmount: parseFloat(depreciationAmount.toFixed(2)),
      currentBuildingValue: parseFloat(currentBuildingValue.toFixed(2)),
      residualLandValue: parseFloat(residualLandValue.toFixed(2)),
      landPricePerSqm: parseFloat(landPricePerSqm.toFixed(2)),
      totalPrice: transactionPrice,
      buildingPercentage: parseFloat(buildingPercentage.toFixed(2)),
      landPercentage: parseFloat(landPercentage.toFixed(2)),
    };
  }
}

export interface CalculationResult {
  pricePerSqm: number | null;
  referenceArea: number;
  residualCalculation?: ResidualCalculationResult;
}

export const PROPERTY_TYPE_IDS = {
  VACANT_LAND: 1,
  AGRICULTURAL_LAND: 2,
  RESIDENTIAL_BUILDING: 3,
  COMMERCIAL_BUILDING: 4,
  AGRICULTURAL_PROPERTY: 5,
  RESIDENTIAL_PROPERTY: 6,
  COMMERCIAL_PROPERTY: 7,
  INDUSTRIAL_PROPERTY: 8,
  SPECIALIZED_PROPERTY: 9,
} as const;

export class PricePerSqmCalculator {
  static calculate(
    propertyTypeId: number,
    transactionPrice: number,
    data: {
      landAreaSqm?: number;
      buildingGrossAreaSqm?: number;
      unitFloorAreaSqm?: number;
      replacementCostPerSqm?: number;
      constructionPercentage?: number;
      effectiveAge?: number;
      usefulLife?: number;
      totalSizeByTitleDeed?: number;
    }
  ): CalculationResult {
    switch (propertyTypeId) {
      case PROPERTY_TYPE_IDS.VACANT_LAND:
      case PROPERTY_TYPE_IDS.AGRICULTURAL_LAND:
        const landSizeToUse =
          data.totalSizeByTitleDeed && data.totalSizeByTitleDeed > 0
            ? data.totalSizeByTitleDeed
            : data.landAreaSqm;
        return this.calculateLandOnly(transactionPrice, landSizeToUse);

      case PROPERTY_TYPE_IDS.RESIDENTIAL_BUILDING:
      case PROPERTY_TYPE_IDS.COMMERCIAL_BUILDING:
        return this.calculateBuildingUnit(
          transactionPrice,
          data.unitFloorAreaSqm
        );

      case PROPERTY_TYPE_IDS.RESIDENTIAL_PROPERTY:
      case PROPERTY_TYPE_IDS.AGRICULTURAL_PROPERTY:
        return this.calculateResidentialWithLand(transactionPrice, data);

      case PROPERTY_TYPE_IDS.COMMERCIAL_PROPERTY:
      case PROPERTY_TYPE_IDS.INDUSTRIAL_PROPERTY:
      case PROPERTY_TYPE_IDS.SPECIALIZED_PROPERTY:
        return this.calculateCommercialIndustrial(transactionPrice, data);

      default:
        return {
          pricePerSqm: null,
          referenceArea: 0,
        };
    }
  }

  private static calculateLandOnly(
    transactionPrice: number,
    areaSqm?: number
  ): CalculationResult {
    if (!areaSqm || areaSqm <= 0) {
      return {
        pricePerSqm: null,
        referenceArea: 0,
      };
    }

    return {
      pricePerSqm: parseFloat((transactionPrice / areaSqm).toFixed(2)),
      referenceArea: areaSqm,
    };
  }

  private static calculateBuildingUnit(
    transactionPrice: number,
    unitFloorAreaSqm?: number
  ): CalculationResult {
    if (!unitFloorAreaSqm || unitFloorAreaSqm <= 0) {
      return {
        pricePerSqm: null,
        referenceArea: 0,
      };
    }

    return {
      pricePerSqm: parseFloat((transactionPrice / unitFloorAreaSqm).toFixed(2)),
      referenceArea: unitFloorAreaSqm,
    };
  }

  private static calculateResidentialWithLand(
    transactionPrice: number,
    data: {
      landAreaSqm?: number;
      buildingGrossAreaSqm?: number;
      replacementCostPerSqm?: number;
      constructionPercentage?: number;
      effectiveAge?: number;
      usefulLife?: number;
      totalSizeByTitleDeed?: number;
    }
  ): CalculationResult {
    if (
      data.landAreaSqm &&
      data.buildingGrossAreaSqm &&
      data.replacementCostPerSqm &&
      data.constructionPercentage !== undefined &&
      data.effectiveAge !== undefined &&
      data.usefulLife
    ) {
      const residualCalc = ResidualMethodCalculator.calculate(
        transactionPrice,
        {
          grossAreaSqm: data.buildingGrossAreaSqm,
          replacementCostPerSqm: data.replacementCostPerSqm,
          constructionPercentage: data.constructionPercentage,
          effectiveAge: data.effectiveAge,
          usefulLife: data.usefulLife,
        },
        data.landAreaSqm || 0,
        data.totalSizeByTitleDeed || 0
      );

      return {
        pricePerSqm: residualCalc.landPricePerSqm,
        referenceArea: data.totalSizeByTitleDeed || data.landAreaSqm || 0,
        residualCalculation: residualCalc,
      };
    }

    const landReferenceArea =
      data.totalSizeByTitleDeed && data.totalSizeByTitleDeed > 0
        ? data.totalSizeByTitleDeed
        : data.landAreaSqm;

    if (landReferenceArea && landReferenceArea > 0) {
      return {
        pricePerSqm: parseFloat(
          (transactionPrice / landReferenceArea).toFixed(2)
        ),
        referenceArea: landReferenceArea,
      };
    }

    if (data.buildingGrossAreaSqm && data.buildingGrossAreaSqm > 0) {
      return {
        pricePerSqm: parseFloat(
          (transactionPrice / data.buildingGrossAreaSqm).toFixed(2)
        ),
        referenceArea: data.buildingGrossAreaSqm,
      };
    }

    return {
      pricePerSqm: null,
      referenceArea: 0,
    };
  }

  private static calculateCommercialIndustrial(
    transactionPrice: number,
    data: {
      landAreaSqm?: number;
      buildingGrossAreaSqm?: number;
      replacementCostPerSqm?: number;
      constructionPercentage?: number;
      effectiveAge?: number;
      usefulLife?: number;
      totalSizeByTitleDeed?: number;
    }
  ): CalculationResult {
    if (data.buildingGrossAreaSqm && data.buildingGrossAreaSqm > 0) {
      if (
        data.landAreaSqm &&
        data.replacementCostPerSqm &&
        data.constructionPercentage !== undefined &&
        data.effectiveAge !== undefined &&
        data.usefulLife
      ) {
        const residualCalc = ResidualMethodCalculator.calculate(
          transactionPrice,
          {
            grossAreaSqm: data.buildingGrossAreaSqm,
            replacementCostPerSqm: data.replacementCostPerSqm,
            constructionPercentage: data.constructionPercentage,
            effectiveAge: data.effectiveAge,
            usefulLife: data.usefulLife,
          },
          data.landAreaSqm || 0,
          data.totalSizeByTitleDeed || 0
        );

        return {
          pricePerSqm: parseFloat(
            (transactionPrice / data.buildingGrossAreaSqm).toFixed(2)
          ),
          referenceArea: data.buildingGrossAreaSqm,
          residualCalculation: residualCalc,
        };
      }

      return {
        pricePerSqm: parseFloat(
          (transactionPrice / data.buildingGrossAreaSqm).toFixed(2)
        ),
        referenceArea: data.buildingGrossAreaSqm,
      };
    }

    const landReferenceArea =
      data.totalSizeByTitleDeed && data.totalSizeByTitleDeed > 0
        ? data.totalSizeByTitleDeed
        : data.landAreaSqm;

    if (landReferenceArea && landReferenceArea > 0) {
      return {
        pricePerSqm: parseFloat(
          (transactionPrice / landReferenceArea).toFixed(2)
        ),
        referenceArea: landReferenceArea,
      };
    }

    return {
      pricePerSqm: null,
      referenceArea: 0,
    };
  }
}
