import crypto from "node:crypto";

const hashValue = (value: string) =>
  crypto.createHash("sha1").update(value).digest("hex");

const normalizeWhitespace = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const formatCoordinate = (value: number) => value.toFixed(6);

export const cacheKeys = {
  address: {
    provinces: "address:provinces",
    districtsByProvince: (provinceCode: string) =>
      `address:districts:${normalizeWhitespace(provinceCode)}`,
    communesByDistrict: (districtCode: string) =>
      `address:communes:${normalizeWhitespace(districtCode)}`,
    villagesByCommune: (communeCode: string) =>
      `address:villages:${normalizeWhitespace(communeCode)}`,
  },
  propertyType: {
    all: "property-type:all",
    byId: (id: number) => `property-type:${id}`,
  },
  property: {
    statisticsVersion: "property:statistics:version",
    statistics: (
      filters: {
        startDate?: Date;
        endDate?: Date;
        propertyTypeId?: number;
        provinceId?: string;
        status?: string;
      },
      version: number,
    ) =>
      `property:statistics:v${version}:${hashValue(
        JSON.stringify({
          startDate: filters.startDate?.toISOString() ?? null,
          endDate: filters.endDate?.toISOString() ?? null,
          propertyTypeId: filters.propertyTypeId ?? null,
          provinceId: filters.provinceId ?? null,
          status: filters.status ?? null,
        }),
      )}`,
  },
  googleMaps: {
    geocode: (address: string) =>
      `google-maps:geocode:${hashValue(normalizeWhitespace(address))}`,
    reverseGeocode: (latitude: number, longitude: number) =>
      `google-maps:reverse:${formatCoordinate(latitude)}:${formatCoordinate(
        longitude,
      )}`,
  },
};
