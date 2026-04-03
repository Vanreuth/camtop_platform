import React, { useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  MapPin, 
  MapPinned, 
  Loader2, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2,
  Ruler,
  Navigation
} from "lucide-react";
import { PropertyAddressForm } from "@/components/PropertyAddressForm";
import { GoogleMapGIS } from "@/components/googleMap/GoogleMapGIS";
import { AddressTabProps } from "@/types/propertyAddress.types";
import { cn } from "@/lib/utils";

// ==================== CONSTANTS ====================
const DEFAULT_LAT = 11.5564;
const DEFAULT_LNG = 104.9282;
const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;
const AREA_SQM_TO_HA = 0.0001;
const AREA_LARGE_THRESHOLD = 10000;

// ==================== HELPER FUNCTIONS ====================

const isValidCoordinate = (value: number, min: number, max: number): boolean => {
  return Number.isFinite(value) && value >= min && value <= max;
};

const parseCoordinate = (coordStr: string, min: number, max: number): number | null => {
  if (!coordStr || coordStr.trim() === '') return null;
  const num = parseFloat(coordStr);
  return isValidCoordinate(num, min, max) ? num : null;
};

// ✅ OPTIMIZATION: Memoize area calculation to avoid recalculation
const calculatePolygonAreaMemoized = (() => {
  const cache = new WeakMap<any, number>();
  
  return (shape: any): number | null => {
    if (!shape || !window.google?.maps?.geometry?.spherical) return null;
    
    // Check cache first
    if (cache.has(shape.shape)) {
      return cache.get(shape.shape)!;
    }
    
    let area: number | null = null;
    
    try {
      if (shape.type === "polygon" && shape.shape?.getPath) {
        const path = shape.shape.getPath();
        if (path.getLength() < 3) return null;
        area = google.maps.geometry.spherical.computeArea(path);
      } else if (shape.type === "rectangle" && shape.shape?.getBounds) {
        const bounds = shape.shape.getBounds();
        if (!bounds) return null;
        
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const path = [
          new google.maps.LatLng(sw.lat(), sw.lng()),
          new google.maps.LatLng(sw.lat(), ne.lng()),
          new google.maps.LatLng(ne.lat(), ne.lng()),
          new google.maps.LatLng(ne.lat(), sw.lng()),
        ];
        
        area = google.maps.geometry.spherical.computeArea(path);
      } else if (shape.type === "circle" && shape.shape?.getRadius) {
        const radius = shape.shape.getRadius();
        if (radius <= 0) return null;
        area = Math.PI * radius * radius;
      }
      
      if (area !== null) {
        cache.set(shape.shape, area);
      }
      
      return area;
    } catch (error) {
      console.warn('Failed to calculate polygon area:', error);
      return null;
    }
  };
})();

const formatArea = (areaSqm: number): string => {
  if (!Number.isFinite(areaSqm) || areaSqm < 0) return '0 m²';
  
  if (areaSqm < 1) {
    return `${(areaSqm * 10000).toFixed(2)} cm²`;
  }
  
  if (areaSqm < AREA_LARGE_THRESHOLD) {
    return `${areaSqm.toFixed(2)} m²`;
  }
  
  const hectares = areaSqm * AREA_SQM_TO_HA;
  return `${hectares.toFixed(4)} ha (${areaSqm.toFixed(2)} m²)`;
};

export const AddressTab: React.FC<AddressTabProps> = ({
  formData,
  addressCodes,
  resolvedAddressItems,
  onInputChange,
  onAddressChange,
  onCoordinatesChange,
  onReverseGeocode,
  onShapesChange,
  isReverseGeocoding = false,
  shapes = [],
  existingPolygon = null,
  disableBoundaryPinUpdate = false,
  enableShapeDrawing = true,
  showMap = false,
  mapHeight = "700px",
  onReset,
  t,
}) => {
  // ✅ OPTIMIZATION: Only recalculate shape indicators when shapes array reference changes
  const shapeIndicators = useMemo(() => {
    const hasPolygon = shapes.some((shape) => shape.type === "polygon");
    const hasRectangle = shapes.some((shape) => shape.type === "rectangle");
    const hasCircle = shapes.some((shape) => shape.type === "circle");

    // Calculate total area with memoized function
    let totalArea = 0;
    shapes.forEach((shape) => {
      const area = calculatePolygonAreaMemoized(shape);
      if (area && Number.isFinite(area)) {
        totalArea += area;
      }
    });

    return {
      hasPolygon,
      hasRectangle,
      hasCircle,
      total: shapes.length,
      totalArea,
      message: hasPolygon
        ? "Polygon will be saved with property."
        : !hasPolygon && hasRectangle
        ? "Rectangle will be converted to a polygon."
        : !hasPolygon && !hasRectangle && hasCircle
        ? "Circle will be converted to a polygon."
        : "",
    };
  }, [shapes]); // ✅ Only shapes dependency, not individual properties

  // ✅ OPTIMIZATION: Memoize coordinates validation separately
  const coordinates = useMemo(() => {
    const lat = parseCoordinate(formData.latitude, LAT_MIN, LAT_MAX);
    const lng = parseCoordinate(formData.longitude, LNG_MIN, LNG_MAX);
    const isValid = lat !== null && lng !== null;

    return {
      latitude: lat ?? DEFAULT_LAT,
      longitude: lng ?? DEFAULT_LNG,
      isValid,
    };
  }, [formData.latitude, formData.longitude]);

  // ✅ OPTIMIZATION: Stable callback reference
  const handleFieldChange = useCallback(
    (field: string, value: string) => {
      onInputChange(field, value);
    },
    [onInputChange]
  );

  const shouldShowLoading = isReverseGeocoding;
  const effectiveAddressCodes = useMemo(
    () => {
      const normalizeCode = (code: string | null | undefined) => {
        const trimmed = code?.trim();
        return trimmed ? trimmed : null;
      };

      return {
        provinceId: normalizeCode(addressCodes.provinceId) ?? normalizeCode(formData.provinceId),
        districtId: normalizeCode(addressCodes.districtId) ?? normalizeCode(formData.districtId),
        communeId: normalizeCode(addressCodes.communeId) ?? normalizeCode(formData.communeId),
        villageId: normalizeCode(addressCodes.villageId) ?? normalizeCode(formData.villageId),
      };
    },
    [
      addressCodes.communeId,
      addressCodes.districtId,
      addressCodes.provinceId,
      addressCodes.villageId,
      formData.communeId,
      formData.districtId,
      formData.provinceId,
      formData.villageId,
    ]
  );

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <MapPin className="h-5 w-5 text-blue-600" />
              {t("address")} & {t("location")}
            </CardTitle>
            {/* ✅ OPTIMIZATION: Only show loading badge when truly loading */}
            {shouldShowLoading && (
              <Badge variant="secondary" className="animate-pulse bg-blue-100 text-blue-700 border-blue-300">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Resolving Address...
              </Badge>
            )}
          </div>
          {onReset && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
              className="flex items-center gap-2 text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              {t("clearTab")}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Cascading Location Dropdowns */}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">{t("areaSelection")}</h3>
          </div>
          <PropertyAddressForm
            value={effectiveAddressCodes}
            resolvedAddressItems={resolvedAddressItems}
            onAddressChange={onAddressChange}
          />
        </div>

        {/* Street and House Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="street" className="text-sm font-medium text-gray-700">
              {t("street")}
            </Label>
            <Input
              id="street"
              type="text"
              value={formData.street}
              onChange={(e) => handleFieldChange("street", e.target.value)}
              placeholder={t("streetPlaceholder")}
              className="w-full h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="houseNo" className="text-sm font-medium text-gray-700">
              {t("houseNo")}
            </Label>
            <Input
              id="houseNo"
              type="text"
              value={formData.houseNo}
              onChange={(e) => handleFieldChange("houseNo", e.target.value)}
              placeholder={t("houseNoPlaceholder")}
              className="w-full h-11"
            />
          </div>
        </div>

        {/* Coordinate Validation Alert */}
        {!coordinates.isValid && (formData.latitude || formData.longitude) && (
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-900">
              <p className="font-medium">Invalid Coordinates</p>
              <p className="text-xs text-amber-700 mt-1">
                Latitude must be between -90 and 90. Longitude must be between -180 and 180.
              </p>
            </div>
          </div>
        )}

        {/* Map Section */}
        <div className="space-y-3">
          {showMap ? (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-blue-600" />
                  Pin Location on Map
                </Label>
                {/* ✅ OPTIMIZATION: Removed redundant loading indicator */}
              </div>

              {/* Google Map */}
              <div className="rounded-lg overflow-hidden border-2 border-slate-200">
                <GoogleMapGIS
                  coordinates={coordinates}
                  addressCodes={effectiveAddressCodes}
                  preservePinWhenInsideSelectedBoundary={coordinates.isValid}
                  onCoordinatesChange={onCoordinatesChange}
                  onAddressCodesChange={onAddressChange}
                  onReverseGeocode={onReverseGeocode}
                  enableShapeDrawing={enableShapeDrawing}
                  onShapesChange={onShapesChange}
                  existingPolygon={existingPolygon || undefined}
                  disableBoundaryPinUpdate={disableBoundaryPinUpdate}
                  height={mapHeight}
                />
              </div>

              {/* Shape Drawing Status with Area */}
              {enableShapeDrawing && shapeIndicators.total > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg flex-shrink-0">
                      <Ruler className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-blue-900">
                          {shapeIndicators.total} shape{shapeIndicators.total !== 1 ? "s" : ""} drawn
                        </div>
                        {shapeIndicators.totalArea > 0 && (
                          <Badge className="bg-blue-600 text-white">
                            {formatArea(shapeIndicators.totalArea)}
                          </Badge>
                        )}
                      </div>
                      {shapeIndicators.message && (
                        <p className="text-xs text-blue-700">{shapeIndicators.message}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {shapeIndicators.hasPolygon && (
                          <Badge variant="outline" className="text-xs bg-white border-blue-300">
                            Polygon
                          </Badge>
                        )}
                        {shapeIndicators.hasRectangle && (
                          <Badge variant="outline" className="text-xs bg-white border-green-300">
                            Rectangle
                          </Badge>
                        )}
                        {shapeIndicators.hasCircle && (
                          <Badge variant="outline" className="text-xs bg-white border-orange-300">
                            Circle
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Existing Polygon Indicator */}
              {existingPolygon && shapes.length === 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-green-900">
                      <span className="font-medium">Existing polygon loaded</span> (
                      {existingPolygon.coordinates?.[0]?.length || 0} points). Draw a new shape to replace it.
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Map is available on the property details page only.
            </div>
          )}

          {/* Coordinates Display */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Navigation className="h-4 w-4 text-slate-600" />
              GPS Coordinates
            </Label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude" className="text-xs text-muted-foreground flex items-center gap-1">
                  Latitude
                  {!coordinates.isValid && formData.latitude && (
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                  )}
                  {coordinates.isValid && formData.latitude && (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  )}
                </Label>
                <Input
                  id="latitude"
                  type="text"
                  value={formData.latitude}
                  onChange={(e) => handleFieldChange("latitude", e.target.value)}
                  placeholder="11.5564"
                  className={cn(
                    "font-mono text-sm h-10",
                    !coordinates.isValid && formData.latitude ? "border-amber-300 bg-amber-50" : "",
                    coordinates.isValid && formData.latitude ? "border-green-300 bg-green-50/50" : ""
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude" className="text-xs text-muted-foreground flex items-center gap-1">
                  Longitude
                  {!coordinates.isValid && formData.longitude && (
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                  )}
                  {coordinates.isValid && formData.longitude && (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  )}
                </Label>
                <Input
                  id="longitude"
                  type="text"
                  value={formData.longitude}
                  onChange={(e) => handleFieldChange("longitude", e.target.value)}
                  placeholder="104.9282"
                  className={cn(
                    "font-mono text-sm h-10",
                    !coordinates.isValid && formData.longitude ? "border-amber-300 bg-amber-50" : "",
                    coordinates.isValid && formData.longitude ? "border-green-300 bg-green-50/50" : ""
                  )}
                />
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              {showMap
                ? "Click on the map to set coordinates, or type them manually."
                : "Type coordinates manually."}
            </p>
          </div>

          <div
            className={cn(
              "p-4 rounded-lg border",
              formData.formattedAddress
                ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                : "bg-slate-50 border-slate-200"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "p-2 rounded-lg flex-shrink-0",
                  formData.formattedAddress ? "bg-green-600" : "bg-slate-500"
                )}
              >
                <MapPinned className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Detected Address
                </div>
                <Textarea
                  value={formData.formattedAddress}
                  onChange={(e) => handleFieldChange("formattedAddress", e.target.value)}
                  placeholder="Paste a detected address, or paste coordinates like 11.52978335405926, 104.96855134963224."
                  className={cn(
                    "min-h-[96px] resize-y text-sm",
                    formData.formattedAddress
                      ? "border-green-200 bg-white/80 text-green-950"
                      : "bg-white"
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Enter latitude and longitude, click the map, or paste a coordinate pair to auto-fill latitude,
                  longitude, and then resolve the province, district, commune, and village flow.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
