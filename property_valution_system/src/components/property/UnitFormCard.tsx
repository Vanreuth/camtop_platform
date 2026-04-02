"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { UnitData } from "@/types/property.types";
import { DepreciationCalculatorPanel } from "./DepreciationCalculatorPanel";
import { VIEW_TYPE_OPTIONS } from "@/constants/viewTypeOptions";

interface UnitFormCardProps {
  unit: UnitData;
  unitIndex: number;
  buildingIndex: number;
  onUpdate: (buildingIndex: number, unitIndex: number, field: string, value: any) => void;
  onRemove: (buildingIndex: number, unitIndex: number) => void;
  onAutoCalculateUnitCost?: (buildingIndex: number, unitIndex: number) => void;
  totalSizeByTitleDeed?: string;
  t: (key: string) => string;
}

export function UnitFormCard({
  unit,
  unitIndex,
  buildingIndex,
  onUpdate,
  onRemove,
  onAutoCalculateUnitCost,
  totalSizeByTitleDeed,
  t,
}: UnitFormCardProps) {
  const handleAutoCalculate = () => {
    if (onAutoCalculateUnitCost) {
      onAutoCalculateUnitCost(buildingIndex, unitIndex);
    }
  };

  // Check if we should show depreciation panel
  const showDepreciation =
    unit.floorAreaSqm &&
    unit.replacementCostPerSqm &&
    unit.effectiveAge &&
    unit.usefulLife;

  return (
    <Card className="border-2">
      <CardContent className="pt-4 space-y-4">
        {/* Unit Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-lg">Unit {unit.unitNo}</p>
            {unit.floorNo && (
              <p className="text-sm text-muted-foreground">Floor {unit.floorNo}</p>
            )}
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onRemove(buildingIndex, unitIndex)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Unit Basic Info */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">{t("unitNo")}</Label>
            <Input
              value={unit.unitNo}
              onChange={(e) => onUpdate(buildingIndex, unitIndex, "unitNo", e.target.value)}
              placeholder={t("unitNoPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("unitType")}</Label>
            <Select
              value={unit.unitType}
              onValueChange={(value) => onUpdate(buildingIndex, unitIndex, "unitType", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectUnitType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDIO">Studio</SelectItem>
                <SelectItem value="ONE_BEDROOM">1 Bedroom</SelectItem>
                <SelectItem value="TWO_BEDROOM">2 Bedrooms</SelectItem>
                <SelectItem value="THREE_BEDROOM">3 Bedrooms</SelectItem>
                <SelectItem value="PENTHOUSE">Penthouse</SelectItem>
                <SelectItem value="DUPLEX">Duplex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("floorNo")}</Label>
            <Input
              type="number"
              value={unit.floorNo}
              onChange={(e) => onUpdate(buildingIndex, unitIndex, "floorNo", e.target.value)}
              placeholder={t("floorNoPlaceholder")}
            />
          </div>
        </div>

        {/* Unit Areas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">{t("floorArea")}</Label>
            <Input
              type="number"
              step="0.01"
              value={unit.floorAreaSqm}
              onChange={(e) => {
                onUpdate(buildingIndex, unitIndex, "floorAreaSqm", e.target.value);
                handleAutoCalculate();
              }}
              placeholder={t("enterFloorArea")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("totalArea")}</Label>
            <Input
              type="number"
              step="0.01"
              value={unit.totalAreaSqm}
              onChange={(e) => onUpdate(buildingIndex, unitIndex, "totalAreaSqm", e.target.value)}
              placeholder={t("enterTotalArea")}
            />
          </div>
        </div>

        {/* Unit Features */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">{t("bedrooms")}</Label>
            <Input
              type="number"
              value={unit.numberOfBedrooms}
              onChange={(e) => onUpdate(buildingIndex, unitIndex, "numberOfBedrooms", e.target.value)}
              placeholder={t("numberPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("bathrooms")}</Label>
            <Input
              type="number"
              value={unit.numberOfBathrooms}
              onChange={(e) => onUpdate(buildingIndex, unitIndex, "numberOfBathrooms", e.target.value)}
              placeholder={t("numberPlaceholder")}
            />
          </div>
        </div>

        {/* Unit Amenities */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`kitchen-${buildingIndex}-${unitIndex}`}
              checked={unit.hasKitchen}
              onCheckedChange={(checked) =>
                onUpdate(buildingIndex, unitIndex, "hasKitchen", checked)
              }
            />
            <Label htmlFor={`kitchen-${buildingIndex}-${unitIndex}`} className="text-xs">
              {t("hasKitchen")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`living-${buildingIndex}-${unitIndex}`}
              checked={unit.hasLivingRoom}
              onCheckedChange={(checked) =>
                onUpdate(buildingIndex, unitIndex, "hasLivingRoom", checked)
              }
            />
            <Label htmlFor={`living-${buildingIndex}-${unitIndex}`} className="text-xs">
              {t("hasLivingRoom")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`parking-${buildingIndex}-${unitIndex}`}
              checked={unit.hasParkingSpace}
              onCheckedChange={(checked) =>
                onUpdate(buildingIndex, unitIndex, "hasParkingSpace", checked)
              }
            />
            <Label htmlFor={`parking-${buildingIndex}-${unitIndex}`} className="text-xs">
              {t("hasParkingSpace")}
            </Label>
          </div>
        </div>

        {/* Cost Information */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">{t("costPerSqm")}</Label>
            <Input
              type="number"
              step="0.01"
              value={unit.costPerSqm || ""}
              onChange={(e) => {
                onUpdate(buildingIndex, unitIndex, "costPerSqm", e.target.value);
                handleAutoCalculate();
              }}
              placeholder={t("originalConstructionCost")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              Replacement Cost/m² ($)
              <span className="text-orange-500 text-[10px]">(Current)</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              value={unit.replacementCostPerSqm || ""}
              onChange={(e) => {
                onUpdate(buildingIndex, unitIndex, "replacementCostPerSqm", e.target.value);
                handleAutoCalculate();
              }}
              placeholder={t("currentRebuildCost")}
              className="border-orange-200 focus:border-orange-400"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              Total Building Cost ($)
              <span className="text-blue-600 text-[10px]">(Auto)</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              value={unit.totalBuildingCost || ""}
              readOnly
              className="bg-blue-50 border-blue-200 text-blue-900 cursor-not-allowed"
              placeholder={t("floorAreaCalculation")}
            />
          </div>
        </div>

        {/* Age and Life Information */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">{t("constructedYear")}</Label>
            <Input
              type="number"
              value={unit.constructedYear}
              onChange={(e) => {
                onUpdate(buildingIndex, unitIndex, "constructedYear", e.target.value);
                // Auto-calculate effective age
                if (e.target.value) {
                  const currentYear = new Date().getFullYear();
                  const constructedYear = parseInt(e.target.value);
                  const effectiveAge = currentYear - constructedYear;
                  onUpdate(buildingIndex, unitIndex, "effectiveAge", effectiveAge.toString());
                }
              }}
              placeholder={t("constructionYearPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("effectiveAge")}</Label>
            <Input
              type="number"
              value={unit.effectiveAge}
              onChange={(e) => onUpdate(buildingIndex, unitIndex, "effectiveAge", e.target.value)}
              placeholder={t("agePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("usefulLife")}</Label>
            <Input
              type="number"
              value={unit.usefulLife}
              onChange={(e) => onUpdate(buildingIndex, unitIndex, "usefulLife", e.target.value)}
              placeholder={t("yearsPlaceholder")}
            />
          </div>
        </div>

        {/* Depreciation Calculation Panel */}
        {showDepreciation && (
          <DepreciationCalculatorPanel
            floorArea={parseFloat(unit.floorAreaSqm) || 0}
            totalSizeByTitleDeed={totalSizeByTitleDeed ? parseFloat(totalSizeByTitleDeed) : 0}
            replacementCost={parseFloat(unit.replacementCostPerSqm) || 0}
            effectiveAge={parseFloat(unit.effectiveAge) || 0}
            usefulLife={parseFloat(unit.usefulLife) || 0}
            t={t}
          />
        )}

        {/* Additional Info */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Physical Condition</Label>
            <Select
              value={unit.physical_condition || ""}
              onValueChange={(value) =>
                onUpdate(buildingIndex, unitIndex, "physical_condition", value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXCELLENT">Excellent</SelectItem>
                <SelectItem value="GOOD">Good</SelectItem>
                <SelectItem value="FAIR">Fair</SelectItem>
                <SelectItem value="POOR">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("managementFee")}</Label>
            <Input
              value={unit.managementFee || ""}
              onChange={(e) => onUpdate(buildingIndex, unitIndex, "managementFee", e.target.value)}
              placeholder={t("feeAmount")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("viewType")}</Label>
            <Select
              value={unit.viewType || ""}
              onValueChange={(value) => onUpdate(buildingIndex, unitIndex, "viewType", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectView")} />
              </SelectTrigger>
              <SelectContent>
                {VIEW_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
