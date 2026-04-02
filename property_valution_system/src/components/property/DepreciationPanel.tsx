// components/property/DepreciationPanel.tsx
import React from 'react';
import { Calculator, DollarSign, TrendingDown, Clock } from 'lucide-react';

interface DepreciationPanelProps {
  floorArea: number;
  replacementCost: number;
  constructionPercentage: number;
  effectiveAge: number;
  usefulLife: number;
  usesTitleDeedSize?: boolean;
  className?: string;
}

/**
 * DepreciationPanel Component
 * 
 * Displays cost approach valuation using depreciation method.
 * Calculates and shows building value breakdown.
 * 
 * @example
 * <DepreciationPanel
 *   floorArea={100}
 *   replacementCost={500}
 *   constructionPercentage={1.0}
 *   effectiveAge={5}
 *   usefulLife={50}
 * />
 */
export const DepreciationPanel: React.FC<DepreciationPanelProps> = ({
  floorArea,
  replacementCost,
  constructionPercentage,
  effectiveAge,
  usefulLife,
  usesTitleDeedSize = false,
  className = '',
}) => {
  // Calculate depreciation
  const newBuildingCost = floorArea * replacementCost * constructionPercentage;
  const depreciationRatio = usefulLife > 0 ? effectiveAge / usefulLife : 0;
  const depreciationAmount = newBuildingCost * depreciationRatio;
  const currentValue = newBuildingCost - depreciationAmount;
  const remainingLife = Math.max(0, usefulLife - effectiveAge);

  return (
    <div className={`p-4 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg ${className}`}>
      <h6 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
        <Calculator className="h-4 w-4" />
        Cost Approach Valuation (Depreciation Method)
      </h6>

      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          {/* New Building Cost */}
          <div className="bg-white/70 p-2 rounded">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-600 flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                New Building Cost:
              </span>
              {usesTitleDeedSize && (
                <span className="text-[10px] text-purple-600 font-medium bg-purple-100 px-1 rounded">
                  Title Deed
                </span>
              )}
            </div>
            <div className="font-semibold text-purple-900">
              {floorArea.toLocaleString('en-US')} m² × ${replacementCost.toLocaleString('en-US')} × {(constructionPercentage * 100).toFixed(0)}%
              <div className="text-base mt-1">
                = ${newBuildingCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Depreciation Ratio */}
          <div className="bg-white/70 p-2 rounded">
            <span className="text-gray-600 block mb-1 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Depreciation Ratio:
            </span>
            <div className="font-semibold text-orange-600">
              {effectiveAge} / {usefulLife} years
              <div className="text-base mt-1">
                = {(depreciationRatio * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Depreciation Amount */}
          <div className="bg-white/70 p-2 rounded">
            <span className="text-gray-600 block mb-1">Depreciation Amount:</span>
            <div className="font-semibold text-red-600">
              ${newBuildingCost.toLocaleString('en-US', { maximumFractionDigits: 0 })} × {(depreciationRatio * 100).toFixed(1)}%
              <div className="text-base mt-1">
                = ${depreciationAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          {/* Current Value */}
          <div className="bg-white/70 p-2 rounded border-2 border-green-200">
            <span className="text-gray-600 block mb-1">Current Building Value:</span>
            <div className="font-bold text-green-600 text-base">
              ${currentValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Remaining Life */}
        <div className="grid grid-cols-1 gap-2 mt-2">
          <div className="bg-indigo-100 p-2 rounded text-center">
            <span className="text-indigo-800 font-medium flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              Remaining Useful Life: {remainingLife.toFixed(1)} years
              <span className="opacity-75 text-xs ml-1">
                ({((1 - depreciationRatio) * 100).toFixed(1)}% remaining)
              </span>
            </span>
          </div>

          <div className="bg-amber-50 p-2 rounded border border-amber-200">
            <p className="text-amber-800 text-[10px] leading-tight">
              💡 <strong>Cost Approach:</strong> Values building based on replacement cost minus depreciation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};