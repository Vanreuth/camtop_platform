import React from "react";
import {
  parseConstructionPercentage,
  ResidualMethodCalculator,
  type ResidualBuildingInput,
  type ResidualCalculationResult,
} from "@/lib/calculations";
import { Calculator, TrendingUp, Home, DollarSign } from "lucide-react";

interface ValuationSummaryProps {
  type: "COST_APPROACH" | "RESIDUAL";
  data: {
    areaSqm: string;
    replacementCost: string;
    effectiveAge: string;
    usefulLife: string;
    constructionPercentage?: string | number;
    transactionPrice?: string;
    landAreaSqm?: string;
    totalSizeByTitleDeed?: string;
    buildings?: Array<{
      areaSqm: string;
      replacementCost: string;
      effectiveAge: string;
      usefulLife: string;
      constructionPercentage?: string | number;
    }>;
  };
  t: (key: string, params?: Record<string, unknown>) => string;
}

export const ValuationSummary: React.FC<ValuationSummaryProps> = ({
  type,
  data,
  t,
}) => {
  // Parse input values
  const area = parseFloat(data.areaSqm) || 0;
  const cost = parseFloat(data.replacementCost) || 0;
  const age = parseFloat(data.effectiveAge) || 0;
  const life = parseFloat(data.usefulLife) || 0;
  const constructionPct = parseConstructionPercentage(
    data.constructionPercentage || "FULLY_COMPLETED"
  );

  // RESIDUAL METHOD
  if (type === "RESIDUAL") {
    const transactionPrice = parseFloat(data.transactionPrice || "0");
    const landAreaSqm = parseFloat(data.landAreaSqm || "0");
    const totalSizeByTitleDeed = parseFloat(data.totalSizeByTitleDeed || "0");
    const residualBuildings: ResidualBuildingInput[] =
      data.buildings && data.buildings.length > 0
        ? data.buildings
            .map((building) => ({
              grossAreaSqm: parseFloat(building.areaSqm) || 0,
              replacementCostPerSqm: parseFloat(building.replacementCost) || 0,
              constructionPercentage: parseConstructionPercentage(
                building.constructionPercentage || "FULLY_COMPLETED"
              ),
              effectiveAge: parseFloat(building.effectiveAge) || 0,
              usefulLife: parseFloat(building.usefulLife) || 0,
            }))
            .filter(
              (building) =>
                building.grossAreaSqm > 0 &&
                building.replacementCostPerSqm > 0 &&
                building.usefulLife > 0
            )
        : [
            {
              grossAreaSqm: area,
              replacementCostPerSqm: cost,
              constructionPercentage: constructionPct,
              effectiveAge: age,
              usefulLife: life,
            },
          ].filter(
            (building) =>
              building.grossAreaSqm > 0 &&
              building.replacementCostPerSqm > 0 &&
              building.usefulLife > 0
          );

    // Validate residual-specific fields
    if (transactionPrice <= 0) {
      return (
        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-xs text-orange-600">
            ⚠️ {t("transactionPriceRequired")}
          </p>
        </div>
      );
    }

    if (landAreaSqm <= 0 && totalSizeByTitleDeed <= 0) {
      return (
        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-xs text-orange-600">
            ⚠️ {t("landAreaRequired")}
          </p>
        </div>
      );
    }

    if (residualBuildings.length === 0) {
      return (
        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-xs text-orange-600">
            ⚠️{" "}
            {t("pleaseFillAllRequiredFields", {
              fields: "Gross Area, Replacement Cost/m², Useful Life",
            })}
          </p>
        </div>
      );
    }

    // Calculate using ResidualMethodCalculator
    let residualCalc: ResidualCalculationResult;
    const usesMultipleBuildings = residualBuildings.length > 1;
    try {
      residualCalc = ResidualMethodCalculator.calculate(
        transactionPrice,
        residualBuildings,
        landAreaSqm,
        totalSizeByTitleDeed
      );
    } catch (error) {
      return (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-600">
            ❌ {t("calculationError")}: {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      );
    }

    return (
      <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 border border-blue-300 rounded-lg shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-200">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <h4 className="font-semibold text-blue-900">
            {t("residualMethod")} - {t("landValuation")}
          </h4>
        </div>
        {usesMultipleBuildings && (
          <p className="text-xs text-blue-700 mb-3">
            Buildings used in calculation: {residualBuildings.length}
          </p>
        )}

        {/* Building Calculation */}
        <div className="mb-4 space-y-2">
          <h5 className="text-xs font-medium text-blue-700 uppercase tracking-wide">
            {t("buildingValuation")}
          </h5>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/70 p-2 rounded border border-blue-100">
              <span className="text-xs text-gray-600">{t("newBuildingCost")}</span>
              <div className="font-semibold text-blue-900">
                ${residualCalc.newBuildingCost.toLocaleString()}
              </div>
            </div>
            <div className="bg-white/70 p-2 rounded border border-orange-100">
              <span className="text-xs text-gray-600">
                {t("depreciation")} ({(residualCalc.depreciationRatio * 100).toFixed(1)}%)
              </span>
              <div className="font-semibold text-orange-600">
                -${residualCalc.depreciationAmount.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-2 rounded border border-green-200">
            <span className="text-xs text-gray-600">{t("currentBuildingValue")}</span>
            <div className="font-bold text-green-700 text-base">
              ${residualCalc.currentBuildingValue.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Land Calculation */}
        <div className="mb-4 space-y-2">
          <h5 className="text-xs font-medium text-blue-700 uppercase tracking-wide">
            {t("landValuation")}
          </h5>
          <div className="bg-gradient-to-r from-blue-100 to-cyan-100 p-3 rounded-lg border border-blue-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-blue-700">{t("residualLandValue")}</span>
              <div className="font-bold text-blue-900 text-lg">
                ${residualCalc.residualLandValue.toLocaleString()}
              </div>
            </div>
            <div className="text-xs text-blue-600">
              = ${transactionPrice.toLocaleString()} - ${residualCalc.currentBuildingValue.toLocaleString()}
            </div>
          </div>
          <div className="bg-white p-2 rounded border border-blue-200">
            <span className="text-xs text-gray-600">{t("landPricePerSQM")}</span>
            <div className="font-bold text-cyan-700 text-base">
              ${residualCalc.landPricePerSqm.toLocaleString()} /m²
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Reference Area: {totalSizeByTitleDeed > 0 ? totalSizeByTitleDeed : landAreaSqm} m²
            </div>
          </div>
        </div>

        {/* Value Distribution */}
        <div className="mt-4 pt-3 border-t border-blue-200">
          <h5 className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-2">
            {t("valueDistribution")}
          </h5>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center bg-gradient-to-br from-green-50 to-emerald-50 p-3 rounded-lg border border-green-200">
              <Home className="h-5 w-5 mx-auto mb-1 text-green-600" />
              <div className="text-xs text-gray-600">{t("building")}</div>
              <div className="text-xl font-bold text-green-700">
                {residualCalc.buildingPercentage.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ${residualCalc.currentBuildingValue.toLocaleString()}
              </div>
            </div>
            <div className="text-center bg-gradient-to-br from-blue-50 to-cyan-50 p-3 rounded-lg border border-blue-200">
              <DollarSign className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              <div className="text-xs text-gray-600">{t("land")}</div>
              <div className="text-xl font-bold text-blue-700">
                {residualCalc.landPercentage.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ${residualCalc.residualLandValue.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Formula Reference */}
        <div className="mt-3 pt-3 border-t border-blue-200">
          <details className="text-xs">
            <summary className="cursor-pointer text-blue-700 hover:text-blue-900 font-medium">
              {t("viewFormula")}
            </summary>
            <div className="mt-2 p-2 bg-white/50 rounded border border-blue-100 space-y-1 text-gray-700">
              <p>1. New Building Cost = Σ(Building Area × Replacement Cost × % Construction) = ${residualCalc.newBuildingCost.toLocaleString()}</p>
              <p>2. Depreciation Ratio = Total Depreciation ÷ Total New Building Cost = {(residualCalc.depreciationRatio * 100).toFixed(1)}%</p>
              <p>3. Depreciation Amount = ${residualCalc.newBuildingCost.toLocaleString()} × {(residualCalc.depreciationRatio * 100).toFixed(1)}% = ${residualCalc.depreciationAmount.toLocaleString()}</p>
              <p>4. Current Building Value = ${residualCalc.newBuildingCost.toLocaleString()} - ${residualCalc.depreciationAmount.toLocaleString()} = ${residualCalc.currentBuildingValue.toLocaleString()}</p>
              <p className="font-semibold text-blue-700">5. Residual Land Value = ${transactionPrice.toLocaleString()} - ${residualCalc.currentBuildingValue.toLocaleString()} = ${residualCalc.residualLandValue.toLocaleString()}</p>
            </div>
          </details>
        </div>
      </div>
    );
  }

  // Validate common fields for COST APPROACH
  if (area <= 0 || cost <= 0 || life <= 0) {
    return (
      <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
        <p className="text-xs text-orange-600">
          ⚠️{" "}
          {t("pleaseFillAllRequiredFields", {
            fields: "Gross Area, Replacement Cost/m², Useful Life",
          })}
        </p>
      </div>
    );
  }

  // COST APPROACH calculations
  const newBuildingCost = area * cost * constructionPct;
  const depreciationRatio = age / life;
  const depreciationAmount = newBuildingCost * depreciationRatio;
  const currentValue = newBuildingCost - depreciationAmount;
  const remainingLife = Math.max(0, life - age);

  // COST APPROACH METHOD
  return (
    <div className="mt-4 p-4 bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-50 border border-purple-300 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-purple-200">
        <Calculator className="h-5 w-5 text-purple-600" />
        <h4 className="font-semibold text-purple-900">
          {t("costApproach")} - {t("buildingValuation")}
        </h4>
      </div>

      {/* Calculations */}
      <div className="space-y-3">
        {/* Building Cost Breakdown */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/70 p-2 rounded border border-purple-100">
            <span className="text-xs text-gray-600">{t("newBuildingCost")}</span>
            <div className="font-semibold text-purple-900">
              ${newBuildingCost.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {area} m² × ${cost} × {(constructionPct * 100).toFixed(0)}%
            </div>
          </div>
          <div className="bg-white/70 p-2 rounded border border-orange-100">
            <span className="text-xs text-gray-600">{t("depreciation")}</span>
            <div className="font-semibold text-orange-600">
              {(depreciationRatio * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {age} ÷ {life} years
            </div>
          </div>
        </div>

        {/* Depreciation Amount */}
        <div className="bg-orange-50 p-2 rounded border border-orange-200">
          <span className="text-xs text-gray-600">{t("depreciationAmount")}</span>
          <div className="font-semibold text-orange-700">
            -${depreciationAmount.toLocaleString()}
          </div>
        </div>

        {/* Current Value - Highlighted */}
        <div className="bg-gradient-to-r from-green-100 to-emerald-100 p-3 rounded-lg border-2 border-green-300">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{t("currentBuildingValue")}</span>
            <div className="font-bold text-green-700 text-xl">
              ${currentValue.toLocaleString()}
            </div>
          </div>
          <div className="text-xs text-gray-600 mt-2">
            = ${newBuildingCost.toLocaleString()} - ${depreciationAmount.toLocaleString()}
          </div>
        </div>

        {/* Additional Info */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-indigo-50 p-2 rounded border border-indigo-200 text-center">
            <span className="text-xs text-indigo-700 font-medium">⏳ {t("remainingLife")}</span>
            <div className="text-lg font-bold text-indigo-900">
              {remainingLife.toFixed(0)} years
            </div>
          </div>
          <div className="bg-purple-50 p-2 rounded border border-purple-200 text-center">
            <span className="text-xs text-purple-700 font-medium">📐 {t("pricePerSqm")}</span>
            <div className="text-lg font-bold text-purple-900">
              ${(currentValue / area).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Formula Reference */}
      <div className="mt-3 pt-3 border-t border-purple-200">
        <details className="text-xs">
          <summary className="cursor-pointer text-purple-700 hover:text-purple-900 font-medium">
            {t("viewFormula")}
          </summary>
          <div className="mt-2 p-2 bg-white/50 rounded border border-purple-100 space-y-1 text-gray-700">
            <p>1. New Building Cost = {area} m² × ${cost}/m² × {(constructionPct * 100).toFixed(0)}% = ${newBuildingCost.toLocaleString()}</p>
            <p>2. Depreciation Ratio = {age} years ÷ {life} years = {(depreciationRatio * 100).toFixed(1)}%</p>
            <p>3. Depreciation = ${newBuildingCost.toLocaleString()} × {(depreciationRatio * 100).toFixed(1)}% = ${depreciationAmount.toLocaleString()}</p>
            <p className="font-semibold text-purple-700">4. Current Value = ${newBuildingCost.toLocaleString()} - ${depreciationAmount.toLocaleString()} = ${currentValue.toLocaleString()}</p>
          </div>
        </details>
      </div>
    </div>
  );
};
