"use client";

interface ResidualMethodPanelProps {
  calculation: any | null;
  t: (key: string, params?: any) => string;
}

export function ResidualMethodPanel({ calculation, t }: ResidualMethodPanelProps) {
  if (!calculation) {
    return (
      <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <svg
            className="h-4 w-4 text-blue-600"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 5v6a2 2 0 002 2h6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 19v-6a2 2 0 00-2-2H0" />
          </svg>
          {t("residualMethod")} - {t("landValuation")}
        </h4>
        <div className="text-xs text-orange-600 mt-2">
          {t("pleaseFillAllRequiredFields", {
            fields: "Gross Area, Replacement Cost/m², Construction %, Effective Age, Useful Life, Total Price, Land Area"
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-lg">
      <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
        <svg
          className="h-4 w-4 text-blue-600"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 5v6a2 2 0 002 2h6" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 19v-6a2 2 0 00-2-2H0" />
        </svg>
        {t("residualMethod")} - {t("landValuation")}
      </h4>
      <ul className="text-sm text-blue-900 space-y-1">
        <li>
          <strong>{t("newBuildingCost")}</strong> {calculation.formula.newBuildingCost}{" "}
          <span className="text-gray-500">
            (${calculation.newBuildingCost.toLocaleString()})
          </span>
        </li>
        <li>
          <strong>{t("depreciationRatio")}</strong> {calculation.formula.depreciationRatio}{" "}
          <span className="text-gray-500">({calculation.depreciationRatio})</span>
        </li>
        <li>
          <strong>{t("depreciationAmount")}</strong> {calculation.formula.depreciationAmount}{" "}
          <span className="text-gray-500">
            (${calculation.depreciationAmount.toLocaleString()})
          </span>
        </li>
        <li>
          <strong>{t("currentBuildingValue")}</strong> {calculation.formula.currentBuildingValue}{" "}
          <span className="text-gray-500">
            (${calculation.currentBuildingValue.toLocaleString()})
          </span>
        </li>
        <li>
          <strong>{t("residualLandValue")}</strong> {calculation.formula.residualLandValue}{" "}
          <span className="text-gray-500">
            (${calculation.residualLandValue.toLocaleString()})
          </span>
        </li>
        <li>
          <strong>{t("landPricePerSQM")}</strong> {calculation.formula.landPricePerSqm}{" "}
          <span className="text-gray-500">
            (${calculation.landPricePerSqm.toLocaleString()})
          </span>
        </li>
      </ul>
    </div>
  );
}
