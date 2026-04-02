// components/property/LandInformationCard.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Ruler, 
  TreePine, 
  RectangleHorizontal, 
  Square, 
  Triangle, 
  Hexagon, 
  Shapes
  
} from 'lucide-react';

interface LandInformationCardProps {
  formData: {
    widthMeters: string;
    lengthMeters: string;
    landAreaSqm: string;
    landShape: string;
    topography: string;
    sitePosition: string;
    waterSource: string;
    typeofTree?: string;
    numberOfTrees?: string;
    ageOfTrees?: string;
  };
  onInputChange: (field: string, value: string) => void;
  isAgricultural?: boolean;
  t: (key: string) => string;
}

export const LandInformationCard: React.FC<LandInformationCardProps> = ({
  formData,
  onInputChange,
  isAgricultural = false,
  t,
}) => {
  const formatCalculatedValue = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      return "";
    }

    return value.toFixed(2).replace(/\.?0+$/, "");
  };

  const handleDimensionChange = (field: string, value: string) => {
    onInputChange(field, value);

    const nextWidth =
      field === "widthMeters" ? Number(value) : Number(formData.widthMeters);
    const nextLength =
      field === "lengthMeters" ? Number(value) : Number(formData.lengthMeters);
    const nextArea =
      field === "landAreaSqm" ? Number(value) : Number(formData.landAreaSqm);

    if (field === "widthMeters") {
      if (nextWidth > 0 && nextArea > 0) {
        onInputChange("lengthMeters", formatCalculatedValue(nextArea / nextWidth));
        return;
      }

      if (nextWidth > 0 && nextLength > 0) {
        onInputChange("landAreaSqm", formatCalculatedValue(nextWidth * nextLength));
      }
      return;
    }

    if (field === "lengthMeters") {
      if (nextLength > 0 && nextArea > 0) {
        onInputChange("widthMeters", formatCalculatedValue(nextArea / nextLength));
        return;
      }

      if (nextWidth > 0 && nextLength > 0) {
        onInputChange("landAreaSqm", formatCalculatedValue(nextWidth * nextLength));
      }
      return;
    }

    if (field === "landAreaSqm") {
      if (nextArea > 0 && nextWidth > 0) {
        onInputChange("lengthMeters", formatCalculatedValue(nextArea / nextWidth));
        return;
      }

      if (nextArea > 0 && nextLength > 0) {
        onInputChange("widthMeters", formatCalculatedValue(nextArea / nextLength));
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ruler className="h-5 w-5 text-blue-600" />
          {t('landInformation')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dimensions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="widthMeters">
              {t('widthMeters')}{" "}
              <span className="text-muted-foreground text-xs">({t("optional")})</span>
            </Label>
            <Input
              id="widthMeters"
              type="number"
              step="0.01"
              placeholder={t('enterWidthMeters')}
              value={formData.widthMeters}
              onChange={(e) => handleDimensionChange('widthMeters', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lengthMeters">
              {t('lengthMeters')}{" "}
              <span className="text-muted-foreground text-xs">({t("optional")})</span>
            </Label>
            <Input
              id="lengthMeters"
              type="number"
              step="0.01"
              placeholder={t('enterLengthMeters')}
              value={formData.lengthMeters}
              onChange={(e) => handleDimensionChange('lengthMeters', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="landAreaSqm">
              {t('areaSquareMeters')}{' '}
              <span className="text-muted-foreground text-xs">({t('autoCalculated')})</span>
            </Label>
            <Input
              id="landAreaSqm"
              type="number"
              step="0.01"
              placeholder={t('orEnterAreaDirectly')}
              value={formData.landAreaSqm}
              onChange={(e) => handleDimensionChange('landAreaSqm', e.target.value)}
              className="bg-blue-50 border-blue-200 font-medium"
            />
            {formData.widthMeters && formData.lengthMeters && formData.landAreaSqm && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <span>✓</span>
                <span>
                  {formData.widthMeters}m × {formData.lengthMeters}m = {formData.landAreaSqm}m²
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Land Characteristics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* UPDATED: Land Shape with Icons */}
          <div className="space-y-2">
            <Label htmlFor="landShape">{t('landShape')}</Label>
            <Select value={formData.landShape} onValueChange={(value) => onInputChange('landShape', value)}>
              <SelectTrigger id="landShape">
                <SelectValue placeholder={t('selectShapePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RECTANGLE">
                  <div className="flex items-center gap-2">
                    <RectangleHorizontal className="h-4 w-4 text-muted-foreground" />
                    <span>{t('rectangle')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="SQUARE">
                  <div className="flex items-center gap-2">
                    <Square className="h-4 w-4 text-muted-foreground" />
                    <span>{t('square')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="TRIANGLE">
                   <div className="flex items-center gap-2">
                    <Triangle className="h-4 w-4 text-muted-foreground" />
                    <span>{t('triangle')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="IRREGULAR">
                   <div className="flex items-center gap-2">
                    <Hexagon className="h-4 w-4 text-muted-foreground" />
                    <span>{t('irregular')}</span>
                  </div>
                </SelectItem>
                <SelectItem value="SHAPE">
                   <div className="flex items-center gap-2">
                    <Shapes className="h-4 w-4 text-muted-foreground" />
                    <span>{t('shape')}</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topography">{t('topography')}</Label>
            <Select value={formData.topography} onValueChange={(value) => onInputChange('topography', value)}>
              <SelectTrigger id="topography">
                <SelectValue placeholder={t('selectTopographyPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LEVEL">{t('level')}</SelectItem>
                <SelectItem value="SLOPED">{t('sloped')}</SelectItem>
                <SelectItem value="FILLED">{t('filled')}</SelectItem>
                <SelectItem value="UNLEVEL">{t('unlevel')}</SelectItem>
                <SelectItem value="UNFILLED">{t('unfilled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sitePosition">{t('sitePosition')}</Label>
            <Select value={formData.sitePosition} onValueChange={(value) => onInputChange('sitePosition', value)}>
              <SelectTrigger id="sitePosition">
                <SelectValue placeholder={t('selectPositionPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERMEDIATE">{t('intermediate')}</SelectItem>
                <SelectItem value="CORNER">{t('corner')}</SelectItem>
                <SelectItem value="END">{t('end')}</SelectItem>
                <SelectItem value="MAIN_ROAD">{t('mainRoad')}</SelectItem>
                <SelectItem value="SUB_ROAD">{t('subRoad')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="waterSource">{t('waterSource')}</Label>
            <Select value={formData.waterSource} onValueChange={(value) => onInputChange('waterSource', value)}>
              <SelectTrigger id="waterSource">
                <SelectValue placeholder={t('selectWaterSourcePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CITY_WATER">{t('cityWater')}</SelectItem>
                <SelectItem value="WELL_WATER">{t('wellWater')}</SelectItem>
                <SelectItem value="RIVER_ACCESS">{t('riverAccess')}</SelectItem>
                <SelectItem value="POND">{t('pond')}</SelectItem>
                <SelectItem value="NONE">{t('none')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Agricultural Details */}
        {isAgricultural && (
          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <TreePine className="h-4 w-4" />
              {t('agriculturalDetails')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="typeofTree">{t('typeOfTree')}</Label>
                <Select value={formData.typeofTree} onValueChange={(value) => onInputChange('typeofTree', value)}>
                  <SelectTrigger id="typeofTree">
                    <SelectValue placeholder={t('selectTreeTypePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANGO">{t('mango')}</SelectItem>
                    <SelectItem value="COCONUT">{t('coconut')}</SelectItem>
                    <SelectItem value="BANANA">{t('banana')}</SelectItem>
                    <SelectItem value="RUBBER">{t('rubber')}</SelectItem>
                    <SelectItem value="CASHEW">{t('cashew')}</SelectItem>
                    <SelectItem value="PALM">{t('palm')}</SelectItem>
                    <SelectItem value="PEPPER">{t('pepper')}</SelectItem>
                    <SelectItem value="LONGAN">{t('longan')}</SelectItem>
                    <SelectItem value="RAMBUTAN">{t('rambutan')}</SelectItem>
                    <SelectItem value="JACKFRUIT">{t('jackfruit')}</SelectItem>
                    <SelectItem value="OTHER">{t('other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="numberOfTrees">{t('numberOfTrees')}</Label>
                <Input
                  id="numberOfTrees"
                  type="number"
                  placeholder={t('enterNumberOfTrees')}
                  value={formData.numberOfTrees}
                  onChange={(e) => onInputChange('numberOfTrees', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ageOfTrees">{t('ageOfTrees')}</Label>
                <Input
                  id="ageOfTrees"
                  type="number"
                  placeholder={t('enterAgeOfTrees')}
                  value={formData.ageOfTrees}
                  onChange={(e) => onInputChange('ageOfTrees', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
