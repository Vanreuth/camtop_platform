"use client";

import React from "react";

interface DepreciationCalculatorPanelProps {
  floorArea: number;
  totalSizeByTitleDeed?: number;
  replacementCost: number;
  effectiveAge: number;
  usefulLife: number;
  t: (key: string) => string;
}

export function DepreciationCalculatorPanel({
  floorArea,
  totalSizeByTitleDeed = 0,
  replacementCost,
  effectiveAge,
  usefulLife,
  t,
}: DepreciationCalculatorPanelProps) {
  // Prioritize Title Deed Size if available
  const calculationArea = totalSizeByTitleDeed > 0 ? totalSizeByTitleDeed : floorArea;
  const isUsingTitleDeed = totalSizeByTitleDeed > 0;

  // Calculate Cost
  const newBuildingCost = calculationArea * replacementCost;
  
  // Calculate Depreciation
  const depreciationRatio = usefulLife > 0 ? effectiveAge / usefulLife : 0;
  const depreciationAmount = newBuildingCost * depreciationRatio;
  const currentValue = newBuildingCost - depreciationAmount;
  const remainingLife = Math.max(0, usefulLife - effectiveAge);

  return (
    <div className="mt-4 p-4 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
      <h6 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
        <span>📊</span>
        Cost Approach Valuation (Depreciation Method)
      </h6>

      <div className="space-y-2 text-xs">
        {isUsingTitleDeed && (
          <div className="bg-blue-100 p-2 rounded mb-2 border border-blue-300">
            <p className="text-blue-800 font-medium flex items-center gap-1">
              ℹ️ Using Title Deed Size: {totalSizeByTitleDeed.toFixed(2)} m²
              <span className="text-[10px] opacity-75">
                (instead of Floor Area: {floorArea.toFixed(2)} m²)
              </span>
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/70 p-2 rounded">
            <span className="text-gray-600">New Building Cost:</span>
            <div className="font-semibold text-purple-900">
              {calculationArea.toFixed(1)} m² × ${replacementCost.toFixed(0)} = $
              {newBuildingCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-white/70 p-2 rounded">
            <span className="text-gray-600">Depreciation Ratio:</span>
            <div className="font-semibold text-orange-600">
              {effectiveAge} / {usefulLife} = {(depreciationRatio * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-white/70 p-2 rounded">
            <span className="text-gray-600">Depreciation Amount:</span>
            <div className="font-semibold text-red-600">
              ${newBuildingCost.toLocaleString("en-US", { maximumFractionDigits: 0 })} ×{" "}
              {(depreciationRatio * 100).toFixed(1)}% = $
              {depreciationAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-white/70 p-2 rounded">
            <span className="text-gray-600">Current Building Value:</span>
            <div className="font-bold text-green-600 text-base">
              ${currentValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        <div className="bg-indigo-100 p-2 rounded text-center">
          <span className="text-indigo-800 font-medium">
            ⏳ {t("remainingUsefulLife")}: {remainingLife.toFixed(1)} years
            <span className="opacity-75 text-xs ml-1">
              ({((1 - depreciationRatio) * 100).toFixed(1)}% remaining)
            </span>
          </span>
        </div>

        <div className="bg-amber-50 p-2 rounded border border-amber-200">
          <p className="text-amber-800 text-[10px] leading-tight">
            💡 <strong>{t("costApproach")}:</strong> Values building based on replacement cost minus depreciation.
          </p>
        </div>
      </div>
    </div>
  );
}
