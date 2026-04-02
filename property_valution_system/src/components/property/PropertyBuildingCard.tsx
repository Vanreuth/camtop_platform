import React, { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Shapes } from "lucide-react";
import { ValuationSummary } from "@/components/common/ValuationSummary";
import { ImageUploadGrid } from "@/components/common/ImageUploadGrid";
import { PropertyUnitCard } from "./PropertyUnitCard";
import type { BuildingData } from "@/types/property.types";
import type { UnitTypeOption } from "@/constants/buildingUnitOptions";
import { toConstructionPercentageSelectValue } from "@/utils/constructionPercentage";
import { VIEW_TYPE_OPTIONS } from "@/constants/viewTypeOptions";

interface PropertyBuildingCardProps {
  building: BuildingData;
  allBuildings?: BuildingData[];
  index: number;
  totalPrice?: string;
  landAreaSqm?: string;
  totalSizeByTitleDeed?: string;
  photoPreviews: string[];
  isLandAndBuilding: boolean;
  availableBuildingSubtypes?: Array<{
    buildingSubtypeId: number;
    subtypeName: string;
  }>;
  availableUnitTypes?: UnitTypeOption[];
  onUpdate: (field: string, value: unknown) => void;
  onRemove: () => void;
  onAddUnit: () => void;
  onRemoveUnit: (unitIndex: number) => void;
  onUpdateUnit: (unitIndex: number, field: string, value: unknown) => void;
  onImageUpload: (files: FileList | null) => void;
  onRemoveImage: (imgIndex: number) => void;
  onAutoCalculateGrossArea?: () => void;
  onAutoCalculateTotalRooms?: () => void;
  onAutoCalculateEffectiveAge?: () => void;
  onAutoCalculateUnitEffectiveAge?: (unitIndex: number) => void;
  t: (key: string) => string;
}

export const PropertyBuildingCard: React.FC<PropertyBuildingCardProps> = ({
  building,
  allBuildings = [],
  index,
  totalPrice,
  landAreaSqm,
  totalSizeByTitleDeed,
  photoPreviews,
  isLandAndBuilding,
  availableBuildingSubtypes = [],
  availableUnitTypes = [],
  onUpdate,
  onRemove,
  onAddUnit,
  onRemoveUnit,
  onUpdateUnit,
  onImageUpload,
  onRemoveImage,
  onAutoCalculateGrossArea,
  onAutoCalculateTotalRooms,
  onAutoCalculateEffectiveAge,
  onAutoCalculateUnitEffectiveAge,
  t,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const constructionPercentageValue = toConstructionPercentageSelectValue(
    building.percentageOfConstruction,
  );

  return (
    <Card className="border-2 border-blue-100 mb-4">
      <CardHeader className="bg-blue-50 pb-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">
            {t("building")} {index + 1}
          </h4>
          <Button variant="destructive" size="sm" onClick={() => onRemove()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Basic Building Fields */}
        <div className="space-y-2">
          <Label>{t("buildingName")}</Label>
          <Input
            value={building.buildingName}
            onChange={(e) => onUpdate("buildingName", e.target.value)}
            placeholder={t("enterBuildingName")}
          />
        </div>

        {/* Dimensions Grid */}
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>{t("widthMeters")} *</Label>
            <Input
              type="number"
              value={building.width || ""}
              onChange={(e) => {
                onUpdate("width", e.target.value);
                onAutoCalculateGrossArea?.();
              }}
              placeholder={t("widthPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("lengthMeters")} *</Label>
            <Input
              type="number"
              value={building.length || ""}
              onChange={(e) => {
                onUpdate("length", e.target.value);
                onAutoCalculateGrossArea?.();
              }}
              placeholder={t("lengthPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("numberOfStoreys")} *</Label>
            <Input
              type="number"
              value={building.numberOfStorey || ""}
              onChange={(e) => {
                onUpdate("numberOfStorey", e.target.value);
                onAutoCalculateGrossArea?.();
              }}
              placeholder={t("numberOfStoreysPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("grossFloorArea")}</Label>
            <Input
              readOnly
              className="bg-green-50 font-semibold"
              value={building.grossAreaSqm || "0"}
            />
          </div>
        </div>

       

        {/* Status Fields */}
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>{t("constructionStatus")}</Label>
            <Select
              value={building.status}
              onValueChange={(val) => onUpdate("status", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="UNDER_CONSTRUCTION">
                  Under Construction
                </SelectItem>
                <SelectItem value="PLANNED">Planned</SelectItem>
              </SelectContent>
            </Select>
          </div>
           {/* Construction Type */}
        <div className="space-y-2">
          <Label>
            {t("constructionType")} <span className="text-red-500">*</span>
          </Label>
          <Select
            value={building.buildingSubtypeId}
            onValueChange={(value) => onUpdate("buildingSubtypeId", value)}
            disabled={availableBuildingSubtypes.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  availableBuildingSubtypes.length === 0
                    ? "No subtypes available"
                    : "Select construction type"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableBuildingSubtypes.map((st) => (
                <SelectItem
                  key={st.buildingSubtypeId}
                  value={st.buildingSubtypeId.toString()}
                >
                  {st.subtypeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availableBuildingSubtypes.length === 0 && (
            <p className="text-xs text-red-600">{t("noSubtypesMessage")}</p>
          )}
          {building.buildingSubtypeId && (
            <p className="text-xs text-green-600">✓ Valid subtype selected</p>
          )}
        </div>
          <div className="space-y-2">
            <Label>{t("percentageOfConstruction")}</Label>
            <Select
              value={constructionPercentageValue}
              onValueChange={(val) => onUpdate("percentageOfConstruction", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select %" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10%</SelectItem>
                <SelectItem value="20">20%</SelectItem>
                <SelectItem value="30">30%</SelectItem>
                <SelectItem value="40">40%</SelectItem>
                <SelectItem value="50">50%</SelectItem>
                <SelectItem value="60">60%</SelectItem>
                <SelectItem value="70">70%</SelectItem>
                <SelectItem value="80">80%</SelectItem>
                <SelectItem value="90">90%</SelectItem>
                <SelectItem value="100">100%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("viewType")}</Label>
            <Select
              value={building.viewType}
              onValueChange={(val) => onUpdate("viewType", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select view" />
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

        {/* Cost & Lifecycle */}
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-orange-600">
              {t("replacementCostPerSquareMeter")} *
            </Label>
            <Input
              type="number"
              value={building.replacementCostPerSqm || ""}
              onChange={(e) =>
                onUpdate("replacementCostPerSqm", e.target.value)
              }
              className="border-orange-300"
              placeholder="$/m²"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("constructionYear")}</Label>
            <Input
              type="number"
              value={building.constructionYear || ""}
              onChange={(e) => {
                onUpdate("constructionYear", e.target.value);
                onAutoCalculateEffectiveAge?.();
              }}
              placeholder="YYYY"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-green-600">{t("effectiveAge")}</Label>
            <Input
              readOnly
              className="bg-green-50 font-semibold"
              value={building.effectiveAge || "0"}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("usefulLife")}</Label>
            <Input
              type="number"
              value={building.usefulLife || "50"}
              onChange={(e) => onUpdate("usefulLife", e.target.value)}
              placeholder="Years"
            />
          </div>
        </div>

        {/* Cost Approach Valuation for Building */}
        {building.replacementCostPerSqm && building.effectiveAge && (
          <ValuationSummary
            type="COST_APPROACH"
            t={t}
            data={{
              areaSqm: building.grossAreaSqm,
              replacementCost: building.replacementCostPerSqm,
              effectiveAge: building.effectiveAge,
              usefulLife: building.usefulLife,
              constructionPercentage: building.percentageOfConstruction,
            }}
          />
        )}

        {/* Residual Method (Only for first building on Land+Building) */}
        {isLandAndBuilding && index === 0 && totalPrice && (
          <ValuationSummary
            type="RESIDUAL"
            t={t}
            data={{
              areaSqm: building.grossAreaSqm,
              replacementCost: building.replacementCostPerSqm,
              effectiveAge: building.effectiveAge,
              usefulLife: building.usefulLife,
              constructionPercentage: building.percentageOfConstruction,
              buildings: allBuildings.map((b) => ({
                areaSqm: b.grossAreaSqm,
                replacementCost: b.replacementCostPerSqm,
                effectiveAge: b.effectiveAge,
                usefulLife: b.usefulLife,
                constructionPercentage: b.percentageOfConstruction,
              })),
              transactionPrice: totalPrice,
              landAreaSqm: landAreaSqm,
              totalSizeByTitleDeed: totalSizeByTitleDeed,
            }}
          />
        )}

        {/* Room Config Toggle */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          <Shapes className="mr-2 h-4 w-4" />
          {isExpanded ? t("hideRoomConfig") : t("showRoomConfig")}
        </Button>

        {isExpanded && (
          <div className="bg-slate-50 p-4 rounded-md space-y-4">
            <h6 className="font-semibold text-sm mb-3">
              {t("roomConfiguration")}
            </h6>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">{t("bedroom")}</Label>
                <Input
                  type="number"
                  value={building.bedroom || ""}
                  onChange={(e) => {
                    onUpdate("bedroom", e.target.value);
                    onAutoCalculateTotalRooms?.();
                  }}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t("bathroom")}</Label>
                <Input
                  type="number"
                  value={building.bathroom || ""}
                  onChange={(e) => {
                    onUpdate("bathroom", e.target.value);
                    onAutoCalculateTotalRooms?.();
                  }}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t("livingroom")}</Label>
                <Input
                  type="number"
                  value={building.livingroom || ""}
                  onChange={(e) => {
                    onUpdate("livingroom", e.target.value);
                    onAutoCalculateTotalRooms?.();
                  }}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t("kitchen")}</Label>
                <Input
                  type="number"
                  value={building.kitchen || ""}
                  onChange={(e) => {
                    onUpdate("kitchen", e.target.value);
                    onAutoCalculateTotalRooms?.();
                  }}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t("diningroom")}</Label>
                <Input
                  type="number"
                  value={building.diningroom || ""}
                  onChange={(e) => {
                    onUpdate("diningroom", e.target.value);
                    onAutoCalculateTotalRooms?.();
                  }}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-green-600">
                  {t("totalRooms")}
                </Label>
                <Input
                  readOnly
                  className="bg-green-50 font-semibold"
                  value={building.totalRoom || "0"}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t("parkingSpace")}</Label>
              <Input
                type="number"
                value={building.parkingSpace || ""}
                onChange={(e) => onUpdate("parkingSpace", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        )}

        {/* Image Upload
        <ImageUploadGrid
          id={`building-${index}-photos`}
          label={t("buildingImages")}
          previews={photoPreviews}
          onUpload={onImageUpload}
          onRemove={onRemoveImage}
          t={t}
        /> */}

        {/* Units Section */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h5 className="font-semibold">Units ({building.units.length})</h5>
            <Button onClick={onAddUnit} size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" /> Add Unit
            </Button>
          </div>
          {building.units.map((unit, uIdx) => (
            <PropertyUnitCard
              key={uIdx}
              unit={unit}
              index={uIdx}
              onUpdate={(field, val) => onUpdateUnit(uIdx, field, val)}
              onRemove={() => onRemoveUnit(uIdx)}
              totalSizeByTitleDeed={totalSizeByTitleDeed || "0"}
              onAutoCalculateEffectiveAge={() =>
                onAutoCalculateUnitEffectiveAge?.(uIdx)
              }
              availableUnitTypes={availableUnitTypes}
              t={t}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
