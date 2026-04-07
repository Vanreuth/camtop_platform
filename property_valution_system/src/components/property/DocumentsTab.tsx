"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

// Import shared types and components
import { PropertyFormData } from "@/lib/type";
import { ImageUploader } from "../common/ImageUploader";

interface DocumentsTabProps {
  formData: PropertyFormData;
  handleInputChange: (field: keyof PropertyFormData, value: any) => void;
  // We accept the full preview object, but this tab only uses specific keys
  photoPreviews: { 
    coverPhoto: string; 
    backSidePhoto: string; 
    [key: string]: any; // Allow other keys to exist without error
  };
  onUpload: (field: any, files: FileList | null) => void;
  onRemove: (field: any) => void;
  onReset: () => void;
  fieldErrors?: Partial<Record<string, string>>;
  onClearFieldError?: (field: keyof PropertyFormData) => void;
}

export function DocumentsTab({
  formData,
  handleInputChange,
  photoPreviews,
  onUpload,
  onRemove,
  onReset,
  fieldErrors,
  onClearFieldError,
}: DocumentsTabProps) {
  // Mock translation function if not using next-intl context directly
  const t = useTranslations("properties");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            {t("certificateOfOwnership")}
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            className="flex items-center gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
          >
            <RotateCcw className="h-4 w-4" />
            {t("clearTab")}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Document Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Title Deed Type */}
          <div className="space-y-2">
            <Label htmlFor="titleDeedType">{t("titleDeedType")}  <span className="text-red-500">*</span></Label>
            <Select
              value={formData.titleDeedType}
              onValueChange={(val) => {
                handleInputChange("titleDeedType", val);
                onClearFieldError?.("titleDeedType");
              }}
            >
              <SelectTrigger
                id="titleDeedType"
                className={fieldErrors?.titleDeedType ? "border-destructive" : ""}
              >
                <SelectValue placeholder={t("selectTitleDeedType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HARD">Hard Title</SelectItem>
                <SelectItem value="SOFT">Soft Title</SelectItem>
                <SelectItem value="STRATA">Strata Title</SelectItem>
                <SelectItem value="LMAP">LMAP</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors?.titleDeedType ? (
              <p className="text-sm text-destructive">{fieldErrors.titleDeedType}</p>
            ) : null}
          </div>

          {/* Title Deed Number */}
          <div className="space-y-2">
            <Label htmlFor="titleDeedNo">{t("titleDeedNo")}</Label>
            <Input
              id="titleDeedNo"
              placeholder={t("enterTitleDeedNumber")}
              value={formData.titleDeedNo}
              onChange={(e) => handleInputChange("titleDeedNo", e.target.value)}
            />
          </div>

          {/* Total Size */}
          <div className="space-y-2">
            <Label htmlFor="totalSizeByTitleDeed">
              {t("totalSizeByTitleDeed")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="totalSizeByTitleDeed"
              type="number"
              placeholder={t("enterTotalSizeByTitleDeed")}
              value={formData.totalSizeByTitleDeed}
              className={fieldErrors?.totalSizeByTitleDeed ? "border-destructive" : ""}
              onChange={(e) => {
                handleInputChange("totalSizeByTitleDeed", e.target.value);
                onClearFieldError?.("totalSizeByTitleDeed");
              }}
            />
            {fieldErrors?.totalSizeByTitleDeed ? (
              <p className="text-sm text-destructive">{fieldErrors.totalSizeByTitleDeed}</p>
            ) : null}
          </div>
        </div>

        {/* Document Photos Section */}
        <div className="space-y-4 pt-4 border-t">
          <Label className="text-base font-semibold">{t("titleDocumentPhotos")}</Label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reusable Image Component: Cover Photo */}
            <ImageUploader
              label="Cover Photo"
              fieldId="coverPhoto"
              previews={photoPreviews.coverPhoto ? [photoPreviews.coverPhoto] : []}
              onUpload={(files) => onUpload("coverPhoto", files)}
              onRemove={() => onRemove("coverPhoto")}
            />

            {/* Reusable Image Component: Back Side Photo */}
            <ImageUploader
              label="Back Side Photo"
              fieldId="backSidePhoto"
              previews={photoPreviews.backSidePhoto ? [photoPreviews.backSidePhoto] : []}
              onUpload={(files) => onUpload("backSidePhoto", files)}
              onRemove={() => onRemove("backSidePhoto")}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
