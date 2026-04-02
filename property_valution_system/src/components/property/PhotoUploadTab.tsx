// components/property/PhotoUploadSection.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Camera, X, ImagePlus } from 'lucide-react';

type PhotoField = 'frontSide' | 'inside' | 'leftSide' | 'rightSide' | 'opposite' | 'buildingImage' | 'gallery' | 'buildingImages' | 'coverPhoto' | 'backSidePhoto';

interface PhotoUploadTabProps {
  photos: {
    frontSide: File | null;
    inside: File | null;
    leftSide: File | null;
    rightSide: File | null;
    opposite: File | null;
    buildingImage: File | null;
    gallery: File[];
  };
  photoPreview: {
    frontSide: string;
    inside: string;
    leftSide: string;
    rightSide: string;
    opposite: string;
    buildingImage: string;
    gallery: string[];
  };
  onPhotoUpload: (field: PhotoField, files: FileList | null) => void;
  onRemovePhoto: (field: PhotoField, index?: number) => void;
  t: (key: string) => string;
}

export const PhotoUploadTab: React.FC<PhotoUploadTabProps> = ({
  photos,
  photoPreview,
  onPhotoUpload,
  onRemovePhoto,
  t,
}) => {
  const singlePhotoFields: Array<{ field: PhotoField; label: string }> = [
    { field: 'frontSide', label: 'Front Side' },
    { field: 'inside', label: 'Inside' },
    { field: 'leftSide', label: 'Left Side' },
    { field: 'rightSide', label: 'Right Side' },
    { field: 'opposite', label: 'Opposite' },
    { field: 'buildingImage', label: 'Building' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-blue-600" />
          {t('propertyPhoto')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Single Photos Grid */}
        <div className="grid grid-cols-2 gap-4">
          {singlePhotoFields.map(({ field, label }) => (
            <div key={field} className="space-y-2">
              <Label>{label}</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                {photoPreview[field as keyof typeof photoPreview] ? (
                  <div className="relative">
                    <img
                      src={photoPreview[field as keyof typeof photoPreview] as string}
                      alt={label}
                      className="w-full h-32 object-cover rounded"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={() => onRemovePhoto(field)}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onPhotoUpload(field, e.target.files)}
                    />
                    <Camera className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-xs text-slate-600">Click to upload</p>
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Gallery */}
        <div className="space-y-2">
          <Label>{t('gallery')}</Label>
          <div className="border-2 border-dashed rounded-lg p-4">
            <label className="cursor-pointer block text-center mb-4">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onPhotoUpload('gallery', e.target.files)}
              />
              <ImagePlus className="h-12 w-12 mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-slate-600">Click to upload multiple images</p>
            </label>
            {photoPreview.gallery.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {photoPreview.gallery.map((url, index) => (
                  <div key={index} className="relative">
                    <img
                      src={url}
                      alt={`Gallery ${index + 1}`}
                      className="w-full h-24 object-cover rounded"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => onRemovePhoto('gallery', index)}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};