"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImagePlus, X } from "lucide-react";

interface ImageUploaderProps {
  label: string;
  fieldId: string;
  /**
   * Array of URL strings (e.g. blob:http://... or https://...) to display
   */
  previews: string[];
  /**
   * Handler when files are selected
   */
  onUpload: (files: FileList | null) => void;
  /**
   * Handler when an image is removed by index
   */
  onRemove: (index: number) => void;
  /**
   * Allow multiple file selection?
   */
  multiple?: boolean;
  /**
   * CSS height class for the preview images (default: h-32)
   */
  maxHeight?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  label,
  fieldId,
  previews,
  onUpload,
  onRemove,
  multiple = false,
  maxHeight = "h-32",
}) => {
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>

      {/* 1. Preview Grid */}
      {previews.length > 0 && (
        <div className={`grid ${multiple ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1"} gap-3 mb-3`}>
          {previews.map((src, idx) => (
            <div key={idx} className="relative group">
              <img
                src={src}
                alt={`${label} preview ${idx + 1}`}
                className={`w-full ${maxHeight} object-cover rounded-lg border-2 border-gray-200`}
              />
              {/* Delete Button (visible on hover) */}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(idx)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* 2. Upload Area */}
      {/* Logic: If single mode and we already have an image, hide the uploader. If multiple, always show. */}
      {(multiple || previews.length === 0) && (
        <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
          <input
            type="file"
            id={fieldId}
            className="hidden"
            accept="image/*" 
            multiple={multiple}
            onChange={(e) => {
              onUpload(e.target.files);
              // Reset value so the same file can be selected again if needed
              e.target.value = "";
            }}
          />
          <label htmlFor={fieldId} className="cursor-pointer block">
            <ImagePlus className="w-10 h-10 mx-auto mb-2 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              Click to upload {label}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {multiple ? "Upload multiple files" : "Single file upload"} (JPG, PNG)
            </p>
          </label>
        </div>
      )}
    </div>
  );
};