import { GoogleMapGIS } from "@/components/googleMap/GoogleMapGIS";
import { Ruler, Square, TriangleAlert } from "lucide-react";

type GeoJSONPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6378137;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

const isFiniteNumber = (value: number) => Number.isFinite(value);

const toLatLngs = (coords: number[][] | undefined): LatLng[] => {
  if (!coords?.length) return [];
  return coords
    .map((pair) => ({ lng: pair?.[0], lat: pair?.[1] }))
    .filter((p) => isFiniteNumber(p.lat) && isFiniteNumber(p.lng));
};

const computePerimeterMeters = (points: LatLng[]) => {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    total += 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return total;
};

const computeAreaSqMeters = (points: LatLng[]) => {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const lng1 = toRadians(p1.lng);
    const lng2 = toRadians(p2.lng);
    const lat1 = toRadians(p1.lat);
    const lat2 = toRadians(p2.lat);
    sum += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
};

const computeCentroid = (points: LatLng[]) => {
  if (!points.length) return null;
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
};

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);

export const GoogleMapPolygon = ({ property }: { property: any }) => {
  if (!property?.propertyLocation) {
    return null;
  }

  const { latitude, longitude, polygon } = property.propertyLocation as {
    latitude: string | number;
    longitude: string | number;
    polygon?: GeoJSONPolygon;
  };

  const lat = typeof latitude === "number" ? latitude : parseFloat(latitude);
  const lng = typeof longitude === "number" ? longitude : parseFloat(longitude);

  const ring = polygon?.type === "Polygon" ? polygon.coordinates?.[0] : undefined;
  const points = toLatLngs(ring);
  const hasValidPolygon = points.length >= 3;
  const perimeter = hasValidPolygon ? computePerimeterMeters(points) : 0;
  const areaSqMeters = hasValidPolygon ? computeAreaSqMeters(points) : 0;
  const centroid = hasValidPolygon ? computeCentroid(points) : null;
  const isValidCoords = isFiniteNumber(lat) && isFiniteNumber(lng);
  const areaHectares = areaSqMeters / 10000;

  return (
    <div className="space-y-4">
      {isValidCoords ? (
        <GoogleMapGIS
          coordinates={{
            latitude: lat,
            longitude: lng,
          }}
          addressCodes={{
            provinceId:
              property.propertyAddress?.province?.code ||
              property.propertyAddress?.provinceId ||
              null,
            districtId:
              property.propertyAddress?.district?.code ||
              property.propertyAddress?.districtId ||
              null,
            communeId:
              property.propertyAddress?.commune?.code ||
              property.propertyAddress?.communeId ||
              null,
            villageId:
              property.propertyAddress?.village?.code ||
              property.propertyAddress?.villageId ||
              null,
          }}
          enableShapeDrawing={false}
          existingPolygon={polygon}
          disableBoundaryPinUpdate={true}
          height="500px"
        />
      ) : (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          Invalid coordinates. Please verify property latitude/longitude.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <div className="flex items-center gap-2 mb-2">
            <Square className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900">Boundary Polygon</span>
          </div>
          {polygon ? (
            <div className="text-sm text-blue-900">
              {hasValidPolygon ? (
                <>
                  <div className="font-medium">Points: {formatNumber(points.length)}</div>
                  <div className="text-xs text-blue-700">GeoJSON Polygon detected</div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-amber-700">
                  <TriangleAlert className="h-4 w-4" />
                  <span>Polygon data is incomplete.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-blue-800">No polygon saved for this property.</div>
          )}
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-center gap-2 mb-2">
            <Ruler className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-900">Measurements</span>
          </div>
          {hasValidPolygon ? (
            <div className="text-sm text-emerald-900 space-y-1">
              <div className="font-medium">Area: {formatNumber(areaSqMeters)} m2</div>
              <div className="text-xs text-emerald-700">~ {formatNumber(areaHectares, 2)} ha</div>
              <div className="font-medium">Perimeter: {formatNumber(perimeter)} m</div>
              {centroid && (
                <div className="text-xs text-emerald-700">
                  Center: {centroid.lat.toFixed(6)}, {centroid.lng.toFixed(6)}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-emerald-800">No measurement available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
