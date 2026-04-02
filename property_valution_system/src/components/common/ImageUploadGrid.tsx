import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImagePlus, X } from "lucide-react";

interface ImageUploadGridProps {
  id: string;
  label: string;
  previews: string[];
  onUpload: (files: FileList | null) => void;
  onRemove: (index: number) => void;
  t: (key: string) => string;
}

export const ImageUploadGrid: React.FC<ImageUploadGridProps> = ({
  id,
  label,
  previews,
  onUpload,
  onRemove,
  t
}) => {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-3">
          {previews.map((preview, idx) => (
            <div key={idx} className="relative group">
              <img src={preview} alt={`Upload ${idx}`} className="w-full h-24 object-cover rounded-lg border-2 border-gray-200" />
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
      <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors">
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          id={id}
          onChange={(e) => onUpload(e.target.files)}
        />
        <label htmlFor={id} className="cursor-pointer block">
          <ImagePlus className="w-10 h-10 mx-auto mb-2 text-gray-400" />
          <p className="text-sm font-medium text-gray-700">{t("clickToUpload") || "Click to upload images"}</p>
        </label>
      </div>
    </div>
  );
};