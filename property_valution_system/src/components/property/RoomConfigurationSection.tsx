"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BuildingData } from "@/types/property.types";

interface RoomConfigurationSectionProps {
  building: BuildingData;
  buildingIndex: number;
  onUpdate: (index: number, field: string, value: any) => void;
  onAutoCalculateTotalRooms: (index: number) => void;
  t: (key: string) => string;
}

export function RoomConfigurationSection({
  building,
  buildingIndex,
  onUpdate,
  onAutoCalculateTotalRooms,
  t,
}: RoomConfigurationSectionProps) {
  const handleRoomChange = (field: string, value: string) => {
    onUpdate(buildingIndex, field, value);
    onAutoCalculateTotalRooms(buildingIndex);
  };

  return (
    <div className="space-y-4 border-t pt-4 mt-4 bg-slate-50 p-4 rounded-lg">
      <h5 className="font-semibold text-sm text-slate-700 mb-3">
        🛋️ {t("showRoomConfig")}
      </h5>

      <div>
        <Label className="text-sm font-semibold mb-2 block">
          🏠 {t("roomDetail")}
        </Label>
        <div className="grid grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Bedrooms</Label>
            <Input
              type="number"
              value={building.bedroom || ""}
              onChange={(e) => handleRoomChange("bedroom", e.target.value)}
              placeholder={t("numberPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Bathrooms</Label>
            <Input
              type="number"
              value={building.bathroom || ""}
              onChange={(e) => handleRoomChange("bathroom", e.target.value)}
              placeholder={t("numberPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("livingRoom")}</Label>
            <Input
              type="number"
              value={building.livingroom || ""}
              onChange={(e) => handleRoomChange("livingroom", e.target.value)}
              placeholder={t("numberPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("kitchen")}</Label>
            <Input
              type="number"
              value={building.kitchen || ""}
              onChange={(e) => handleRoomChange("kitchen", e.target.value)}
              placeholder={t("numberPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t("diningRoom")}</Label>
            <Input
              type="number"
              value={building.diningroom || ""}
              onChange={(e) => handleRoomChange("diningroom", e.target.value)}
              placeholder={t("numberPlaceholder")}
            />
          </div>
        </div>
      </div>

      {/* Total Rooms (Auto-calculated) */}
      <div className="space-y-2">
        <Label className="text-xs flex items-center gap-1">
          {t("totalRooms")}
          <span className="text-blue-600 text-xs">(Auto)</span>
        </Label>
        <Input
          type="number"
          value={building.totalRoom || ""}
          readOnly
          className="bg-blue-50 border-blue-200 text-blue-900 cursor-not-allowed"
          placeholder={t("autoCalculated")}
        />
      </div>

      {/* Parking Space */}
      <div className="space-y-2">
        <Label className="text-xs">{t("parkingSpace")}</Label>
        <Input
          type="number"
          value={building.parkingSpace || ""}
          onChange={(e) => onUpdate(buildingIndex, "parkingSpace", e.target.value)}
          placeholder={t("parkingPlaceholder")}
        />
      </div>
    </div>
  );
}
