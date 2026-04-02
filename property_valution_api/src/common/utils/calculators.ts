import { parseConstructionPercentage}  from "./formatters";
import { PROPERTY_TYPES } from "../constants/propertyTypes";

// Interfaces
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
  constructionPercentage: number | string;
  effectiveAge: number;
  usefulLife: number;
}

export class ResidualMethodCalculator {
  static calculate(
    transactionPrice: number,
    buildingData: ResidualBuildingInput | ResidualBuildingInput[],
    landAreaSqm: number
  ): ResidualCalculationResult {
    const buildings = Array.isArray(buildingData)
      ? buildingData
      : [buildingData];

    const totals = buildings.reduce(
      (acc, building) => {
        const grossAreaSqm = Number(building.grossAreaSqm) || 0;
        const replacementCostPerSqm = Number(building.replacementCostPerSqm) || 0;
        const usefulLife = Number(building.usefulLife) || 0;
        const effectiveAge = Number(building.effectiveAge) || 0;

        if (grossAreaSqm <= 0 || replacementCostPerSqm <= 0 || usefulLife <= 0) {
          return acc;
        }

        const percentage = parseConstructionPercentage(
          building.constructionPercentage
        );
        const depreciationRatio = effectiveAge / usefulLife;
        const buildingNewCost = grossAreaSqm * replacementCostPerSqm * percentage;
        const buildingDepreciation = buildingNewCost * depreciationRatio;

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

    // 3. Current Value
    const currentBuildingValue = newBuildingCost - depreciationAmount;

    // 4. Residual Land
    const residualLandValue = transactionPrice - currentBuildingValue;

    // 5. Price per SQM
    const landPricePerSqm = landAreaSqm > 0 ? residualLandValue / landAreaSqm : 0;

    return {
      newBuildingCost: Number(newBuildingCost.toFixed(2)),
      depreciationRatio: Number(depreciationRatio.toFixed(4)),
      depreciationAmount: Number(depreciationAmount.toFixed(2)),
      currentBuildingValue: Number(currentBuildingValue.toFixed(2)),
      residualLandValue: Number(residualLandValue.toFixed(2)),
      landPricePerSqm: Number(landPricePerSqm.toFixed(2)),
      totalPrice: transactionPrice,
      buildingPercentage: Number(
        (transactionPrice > 0
          ? (currentBuildingValue / transactionPrice) * 100
          : 0
        ).toFixed(2)
      ),
      landPercentage: Number(
        (transactionPrice > 0 ? (residualLandValue / transactionPrice) * 100 : 0).toFixed(2)
      ),
    };
  }
}

interface CalculationResult {
  pricePerSqm: number | null;
  referenceArea: number;
  residualCalculation?: ResidualCalculationResult;
}


 export class PricePerSqmCalculator {

  static calculate(
    propertyTypeId: number,
    transactionPrice: number,
    data: {
      landAreaSqm?: number;
      totalSizeByTitleDeed?: number;
      buildingGrossAreaSqm?: number;
      unitFloorAreaSqm?: number;
      replacementCostPerSqm?: number;
      constructionPercentage?: number;
      effectiveAge?: number;
      usefulLife?: number;
      buildingItems?: ResidualBuildingInput[];
      buildingUnitItems?: Array<{
        floorAreaSqm?: number;
        replacementCostPerSqm?: number;
        effectiveAge?: number;
        usefulLife?: number;
      }>;
    }
  ): CalculationResult {
    const totalBuildingGrossAreaFromItems = (data.buildingItems ?? []).reduce(
      (sum, item) =>
        sum + (item.grossAreaSqm && item.grossAreaSqm > 0 ? item.grossAreaSqm : 0),
      0
    );
    const totalUnitFloorAreaFromItems = (data.buildingUnitItems ?? []).reduce(
      (sum, item) =>
        sum + (item.floorAreaSqm && item.floorAreaSqm > 0 ? item.floorAreaSqm : 0),
      0
    );

    const buildingGrossAreaSqm =
      totalBuildingGrossAreaFromItems > 0
        ? totalBuildingGrossAreaFromItems
        : data.buildingGrossAreaSqm;
    const unitFloorAreaSqm =
      totalUnitFloorAreaFromItems > 0
        ? totalUnitFloorAreaFromItems
        : data.unitFloorAreaSqm;

    const residualInputsFromBuildings = (data.buildingItems ?? []).filter(
      (item) =>
        item.grossAreaSqm > 0 &&
        item.replacementCostPerSqm > 0 &&
        item.usefulLife > 0
    );

    const residualInputsFromUnits = (data.buildingUnitItems ?? [])
      .filter(
        (item) =>
          (item.floorAreaSqm ?? 0) > 0 &&
          (item.replacementCostPerSqm ?? 0) > 0 &&
          (item.usefulLife ?? 0) > 0
      )
      .map((item) => ({
        grossAreaSqm: Number(item.floorAreaSqm),
        replacementCostPerSqm: Number(item.replacementCostPerSqm),
        constructionPercentage: 100,
        effectiveAge: Number(item.effectiveAge ?? 0),
        usefulLife: Number(item.usefulLife),
      }));

    const legacyResidualInput =
      data.buildingGrossAreaSqm &&
      data.buildingGrossAreaSqm > 0 &&
      data.replacementCostPerSqm &&
      data.replacementCostPerSqm > 0 &&
      data.usefulLife &&
      data.usefulLife > 0
        ? [
            {
              grossAreaSqm: data.buildingGrossAreaSqm,
              replacementCostPerSqm: data.replacementCostPerSqm,
              constructionPercentage: data.constructionPercentage ?? 100,
              effectiveAge: data.effectiveAge ?? 0,
              usefulLife: data.usefulLife,
            } satisfies ResidualBuildingInput,
          ]
        : [];

    const residualBuildingInputs =
      residualInputsFromBuildings.length > 0
        ? residualInputsFromBuildings
        : residualInputsFromUnits.length > 0
          ? residualInputsFromUnits
          : legacyResidualInput;

    switch (propertyTypeId) {
      // Land Types - Simple division
      case PROPERTY_TYPES.VACANT_LAND:
      case PROPERTY_TYPES.AGRICULTURAL_LAND:
        return this.calculateLandOnly(transactionPrice, data.landAreaSqm);

      // Building Units - Prioritize Title Deed Size, fallback to Unit Floor Area
      case PROPERTY_TYPES.RESIDENTIAL_BUILDING:
      case PROPERTY_TYPES.COMMERCIAL_BUILDING:
        // Use totalSizeByTitleDeed if available, otherwise use unitFloorAreaSqm
        const effectiveArea = data.totalSizeByTitleDeed || unitFloorAreaSqm;
        return this.calculateBuildingUnit(
          transactionPrice,
          effectiveArea
        );

      // Residential with Land - Use Residual Method if building data available
      case PROPERTY_TYPES.RESIDENTIAL_PROPERTY:
      case PROPERTY_TYPES.AGRICULTURAL_PROPERTY:
        return this.calculateResidentialWithLand(transactionPrice, {
          ...data,
          buildingGrossAreaSqm,
          unitFloorAreaSqm,
          residualBuildingInputs,
        });

      // Commercial/Industrial - Use Building GFA primary, or Residual Method
      case PROPERTY_TYPES.COMMERCIAL_PROPERTY:
      case PROPERTY_TYPES.INDUSTRIAL_PROPERTY:
      case PROPERTY_TYPES.SPECIALIZED_PROPERTY:
        return this.calculateCommercialIndustrial(transactionPrice, {
          ...data,
          buildingGrossAreaSqm,
          unitFloorAreaSqm,
          residualBuildingInputs,
        });

      default:
        return {
          pricePerSqm: null,
          referenceArea: 0,
        };
    }
  }

  private static calculateLandOnly(
    transactionPrice: number,
    totalSizeByTitleDeed?: number
  ): CalculationResult {
    if (!totalSizeByTitleDeed || totalSizeByTitleDeed <= 0) {
      return {
        pricePerSqm: null,
        referenceArea: totalSizeByTitleDeed || 0,
      };
    }

    return {
      pricePerSqm: parseFloat(
        (transactionPrice / totalSizeByTitleDeed).toFixed(2)
      ),
      referenceArea: totalSizeByTitleDeed,
    };
  }

  private static calculateBuildingUnit(
    transactionPrice: number,
    unitFloorAreaSqm?: number
  ): CalculationResult {
    if (!unitFloorAreaSqm || unitFloorAreaSqm <= 0) {
      return {
        pricePerSqm: null,
        referenceArea: unitFloorAreaSqm || 0,
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
      totalSizeByTitleDeed?: number;
      buildingGrossAreaSqm?: number;
      replacementCostPerSqm?: number;
      constructionPercentage?: number;
      effectiveAge?: number;
      usefulLife?: number;
      residualBuildingInputs?: ResidualBuildingInput[];
      unitFloorAreaSqm?: number;
    }
  ): CalculationResult {
    // Use totalSizeByTitleDeed as primary land area, fallback to landAreaSqm
    const effectiveLandArea = data.totalSizeByTitleDeed || data.landAreaSqm;

    // If we have complete building data, use Residual Method
    if (
      effectiveLandArea &&
      data.residualBuildingInputs &&
      data.residualBuildingInputs.length > 0
    ) {
      const residualCalc = ResidualMethodCalculator.calculate(
        transactionPrice,
        data.residualBuildingInputs,
        effectiveLandArea
      );

      return {
        pricePerSqm: residualCalc.landPricePerSqm,
        referenceArea: effectiveLandArea,
        residualCalculation: residualCalc,
      };
    }

    // Fallback: Simple method - Total Price ÷ totalSizeByTitleDeed (or landAreaSqm)
    if (effectiveLandArea && effectiveLandArea > 0) {
      return {
        pricePerSqm: parseFloat(
          (transactionPrice / effectiveLandArea).toFixed(2)
        ),
        referenceArea: effectiveLandArea,
      };
    }

    // Fallback to building GFA
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
      totalSizeByTitleDeed?: number;
      buildingGrossAreaSqm?: number;
      replacementCostPerSqm?: number;
      constructionPercentage?: number;
      effectiveAge?: number;
      usefulLife?: number;
      residualBuildingInputs?: ResidualBuildingInput[];
      unitFloorAreaSqm?: number;
    }
  ): CalculationResult {
    // Use totalSizeByTitleDeed as primary land area, fallback to landAreaSqm
    const effectiveLandArea = data.totalSizeByTitleDeed || data.landAreaSqm;

    // Commercial/Industrial: Building GFA is primary
    if (data.buildingGrossAreaSqm && data.buildingGrossAreaSqm > 0) {
      // If complete building data available, calculate residual for land value
      if (
        effectiveLandArea &&
        data.residualBuildingInputs &&
        data.residualBuildingInputs.length > 0
      ) {
        const residualCalc = ResidualMethodCalculator.calculate(
          transactionPrice,
          data.residualBuildingInputs,
          effectiveLandArea
        );

        return {
          pricePerSqm: parseFloat(
            (transactionPrice / data.buildingGrossAreaSqm).toFixed(2)
          ),
          referenceArea: data.buildingGrossAreaSqm,
          residualCalculation: residualCalc,
        };
      }

      // Simple: Price per GFA
      return {
        pricePerSqm: parseFloat(
          (transactionPrice / data.buildingGrossAreaSqm).toFixed(2)
        ),
        referenceArea: data.buildingGrossAreaSqm,
      };
    }

    // Fallback to totalSizeByTitleDeed (or land area)
    if (effectiveLandArea && effectiveLandArea > 0) {
      return {
        pricePerSqm: parseFloat(
          (transactionPrice / effectiveLandArea).toFixed(2)
        ),
        referenceArea: effectiveLandArea,
      };
    }

    return {
      pricePerSqm: null,
      referenceArea: 0,
    };
  }
}
