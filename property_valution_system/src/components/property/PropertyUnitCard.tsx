import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { UnitData } from "@/types/property.types";
import {
  DEFAULT_UNIT_TYPE_OPTIONS,
  type UnitTypeOption,
} from "@/constants/buildingUnitOptions";
import {
  formatPhysicalCondition,
  normalizePhysicalCondition,
  PHYSICAL_CONDITIONS,
} from "@/utils/physicalCondition";
import { VIEW_TYPE_OPTIONS } from "@/constants/viewTypeOptions";

interface PropertyUnitCardProps {
  unit: UnitData;
  index: number;
  onUpdate: (field: string, value: unknown) => void;
  onRemove: () => void;
  totalSizeByTitleDeed: string;
  onAutoCalculateEffectiveAge?: () => void;
  availableUnitTypes?: UnitTypeOption[];
  t: (key: string) => string;
}

export const PropertyUnitCard: React.FC<PropertyUnitCardProps> = ({
  unit,
  index,
  onUpdate,
  onRemove,
  onAutoCalculateEffectiveAge,
  availableUnitTypes,
  t,
}) => {
  const selectedPhysicalCondition = normalizePhysicalCondition(
    unit.physical_condition
  );
  const unitTypeOptions =
    availableUnitTypes && availableUnitTypes.length > 0
      ? availableUnitTypes
      : DEFAULT_UNIT_TYPE_OPTIONS;
  const hasCurrentUnitType =
    !!unit.unitType &&
    !unitTypeOptions.some((option) => option.value === unit.unitType);

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-blue-50/30 mb-3 border-2 border-slate-200 hover:border-blue-300 transition-all duration-200">
      <CardContent className="pt-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">{index + 1}</span>
            </div>
            <h6 className="font-semibold text-base">Unit {unit.unitNo}</h6>
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove} className="hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Basic Information */}
        <div className="space-y-3">
          <h6 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Basic Information</h6>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium">{t("unitNo")} <span className="text-red-500">*</span></Label>
              <Input 
                value={unit.unitNo || ""} 
                onChange={(e) => onUpdate("unitNo", e.target.value)} 
                placeholder={t("enterUnitNumber")}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">{t("unitType")}</Label>
              <Select value={unit.unitType || ""} onValueChange={(val) => onUpdate("unitType", val)}>
                <SelectTrigger className="h-9"><SelectValue placeholder={t("selectTypePlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {unitTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                  {hasCurrentUnitType && (
                    <SelectItem value={unit.unitType}>
                      {unit.unitType.replace(/_/g, " ")}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">{t("floorNoShort")} <span className="text-red-500">*</span></Label>
              <Input 
                type="number" 
                value={unit.floorNo || ""} 
                onChange={(e) => onUpdate("floorNo", e.target.value)}
                placeholder="Floor"
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">{t("floorAreaShort")}</Label>
              <Input 
                type="number" 
                value={unit.floorAreaSqm || ""} 
                onChange={(e) => onUpdate("floorAreaSqm", e.target.value)}
                placeholder="0.00"
                className="h-9"
              />
            </div>
            
            
        </div>
          <div className="space-y-3">


            <div className="grid grid-cols-3 gap-3">

            <div className="space-y-2">
              <Label className="text-xs font-medium">{t("viewType")}</Label>
              <Select value={unit.viewType || ""} onValueChange={(val) => onUpdate("viewType", val)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select view" /></SelectTrigger>
                <SelectContent>
                  {VIEW_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Management Fee ($/month)</Label>
              <Select value={unit.managementFee || ""} onValueChange={(val) => onUpdate("managementFee", val)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select management fee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONE_DOLLAR_PER_SQM">1$</SelectItem>
                  <SelectItem value="TWO_DOLLAR_PER_SQM">2$</SelectItem>
                  <SelectItem value="THREE_DOLLAR_PER_SQM">3$</SelectItem>
                  <SelectItem value="FOUR_DOLLAR_PER_SQM">4$</SelectItem>
                  <SelectItem value="FIVE_DOLLAR_PER_SQM">5$</SelectItem>
                  <SelectItem value="FREE">Free</SelectItem>
                  <SelectItem value="NONE">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
             <Label className="text-xs font-medium">Physical Condition</Label>
              <Select
                value={selectedPhysicalCondition}
                onValueChange={(val) => onUpdate("physical_condition", val)}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {PHYSICAL_CONDITIONS.map((condition) => (
                    <SelectItem key={condition} value={condition}>
                      {formatPhysicalCondition(condition)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            </div>
            </div>

          
        </div>

        {/* Room Configuration */}
        <div className="space-y-3">
          <h6 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Room Configuration</h6>
          <div className="grid grid-cols-5 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Bedrooms</Label>
              <Input 
                type="number" 
                value={unit.numberOfBedrooms || ""} 
                onChange={(e) => onUpdate("numberOfBedrooms", e.target.value)}
                placeholder="0"
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Bathrooms</Label>
              <Input 
                type="number" 
                value={unit.numberOfBathrooms || ""} 
                onChange={(e) => onUpdate("numberOfBathrooms", e.target.value)}
                placeholder="0"
                className="h-9"
              />
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <Checkbox 
                id={`kitchen-${index}`}
                checked={unit.hasKitchen}
                onCheckedChange={(checked) => onUpdate("hasKitchen", checked)}
              />
              <Label htmlFor={`kitchen-${index}`} className="text-xs font-medium cursor-pointer">
                Kitchen
              </Label>
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <Checkbox 
                id={`living-${index}`}
                checked={unit.hasLivingRoom}
                onCheckedChange={(checked) => onUpdate("hasLivingRoom", checked)}
              />
              <Label htmlFor={`living-${index}`} className="text-xs font-medium cursor-pointer">
                Living Room
              </Label>
            </div>
            <div className="flex items-center space-x-2">
            <Checkbox 
              id={`parking-${index}`}
              checked={unit.hasParkingSpace}
              onCheckedChange={(checked) => onUpdate("hasParkingSpace", checked)}
            />
            <Label htmlFor={`parking-${index}`} className="text-xs font-medium cursor-pointer">
              Parking Space
            </Label>
          </div>
          </div>
        </div>

        {/* Construction & Age */}
        <div className="space-y-3">
          <h6 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Construction & Age</h6>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Construction Year</Label>
              <Input 
                type="number" 
                value={unit.constructedYear || ""} 
                onChange={(e) => {
                  onUpdate("constructedYear", e.target.value);
                  onAutoCalculateEffectiveAge?.();
                }}
                placeholder="YYYY"
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-green-600">Effective Age</Label>
              <Input 
                readOnly
                value={unit.effectiveAge || "0"} 
                className="h-9 bg-green-50 font-semibold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Useful Life (years)</Label>
              <Input 
                type="number" 
                value={unit.usefulLife || "50"} 
                onChange={(e) => onUpdate("usefulLife", e.target.value)}
                placeholder="50"
                className="h-9"
              />
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};
