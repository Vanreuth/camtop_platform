
import { PrismaClient } from "@prisma/client";
import { BadRequestError } from "../../common/errors/badRequest.error";

type AddressContext = {
  province?: { nameEn?: string | null } | null;
  district?: { nameEn?: string | null } | null;
  commune?: { nameEn?: string | null } | null;
};

type LocationHelpers = {
  normalizePolygonData: (polygon: any) => any;
  calculatePolygonCentroid: (polygon: any) => { latitude: number; longitude: number } | null;
  truncateString: (value: string, maxLength: number) => string;
};

export const createPropertyLocationService = (prisma: PrismaClient, googleMapService: any) => {
  const loadAddressContext = async (propertyAddress?: any, strict: boolean = false) => {
    if (!propertyAddress) return { province: null, district: null, commune: null };

    const [province, district, commune] = await Promise.all([
      propertyAddress.provinceId ? prisma.province.findUnique({ where: { code: propertyAddress.provinceId } }) : null,
      propertyAddress.districtId ? prisma.district.findUnique({ where: { code: propertyAddress.districtId } }) : null,
      propertyAddress.communeId ? prisma.commune.findUnique({ where: { code: propertyAddress.communeId } }) : null,
    ]);

    if (strict) {
      if (propertyAddress.provinceId && !province) {
        throw new BadRequestError(`Province with code "${propertyAddress.provinceId}" not found`);
      }
      if (propertyAddress.districtId && !district) {
        throw new BadRequestError(`District with code "${propertyAddress.districtId}" not found`);
      }
      if (propertyAddress.communeId && !commune) {
        throw new BadRequestError(`Commune with code "${propertyAddress.communeId}" not found`);
      }
    }

    return { province, district, commune };
  };

  const validateAddressCodes = async (propertyAddress?: any) =>
    loadAddressContext(propertyAddress, true);

  const getAddressContext = async (propertyAddress?: any) =>
    loadAddressContext(propertyAddress, false);

  const buildCreateLocationData = async (
    data: any,
    addressContext: AddressContext,
    helpers: LocationHelpers
  ) => {
    const { normalizePolygonData, calculatePolygonCentroid, truncateString } = helpers;

    if (!data.propertyLocation && !data.propertyAddress) return null;

    const normalizedPolygon = data.propertyLocation?.polygon
      ? normalizePolygonData(data.propertyLocation.polygon)
      : null;

    const hasValidCoordinates =
      data.propertyLocation &&
      typeof data.propertyLocation === "object" &&
      !!data.propertyLocation.latitude &&
      !!data.propertyLocation.longitude &&
      !isNaN(Number(data.propertyLocation.latitude)) &&
      !isNaN(Number(data.propertyLocation.longitude));

    const hasPolygonOnly = !hasValidCoordinates && normalizedPolygon;

    if (hasPolygonOnly && normalizedPolygon?.type === "Polygon") {
      const centroid = calculatePolygonCentroid(normalizedPolygon);
      if (centroid) {
        try {
          const addressData = await googleMapService.getAddressFromCoordinates(
            centroid.latitude,
            centroid.longitude
          );

          return {
            latitude: centroid.latitude,
            longitude: centroid.longitude,
            googlePoint: `POINT(${centroid.longitude} ${centroid.latitude})`,
            geolocationLink: truncateString(
              addressData?.googleMapLink ||
                googleMapService.getGoogleMapLink(centroid.latitude, centroid.longitude),
              500
            ),
            polygon: normalizedPolygon,
            formattedAddress: addressData ? truncateString(addressData.formattedAddress, 255) : null,
            placeId: addressData ? truncateString(addressData.placeId, 100) : null,
          };
        } catch (error) {
          console.error("Reverse geocoding failed for centroid:", error);
          return {
            latitude: centroid.latitude,
            longitude: centroid.longitude,
            googlePoint: `POINT(${centroid.longitude} ${centroid.latitude})`,
            geolocationLink: truncateString(
              googleMapService.getGoogleMapLink(centroid.latitude, centroid.longitude),
              500
            ),
            polygon: normalizedPolygon,
          };
        }
      }
    } else if (hasValidCoordinates) {
      const { latitude, longitude } = data.propertyLocation;

      try {
        const addressData = await googleMapService.getAddressFromCoordinates(
          Number(latitude),
          Number(longitude)
        );

        if (addressData) {
          return {
            latitude: Number(latitude),
            longitude: Number(longitude),
            googlePoint: `POINT(${longitude} ${latitude})`,
            geolocationLink: truncateString(addressData.googleMapLink, 500),
            polygon: normalizedPolygon,
            formattedAddress: truncateString(addressData.formattedAddress, 255),
            placeId: truncateString(addressData.placeId, 100),
          };
        }

        return {
          latitude: Number(latitude),
          longitude: Number(longitude),
          googlePoint: `POINT(${longitude} ${latitude})`,
          geolocationLink: truncateString(
            googleMapService.getGoogleMapLink(Number(latitude), Number(longitude)),
            500
          ),
          polygon: normalizedPolygon,
        };
      } catch (error) {
        console.error("Reverse geocoding failed:", error);
        return {
          latitude: Number(latitude),
          longitude: Number(longitude),
          googlePoint: `POINT(${longitude} ${latitude})`,
          geolocationLink: truncateString(
            googleMapService.getGoogleMapLink(Number(latitude), Number(longitude)),
            500
          ),
          polygon: normalizedPolygon,
        };
      }
    } else if (data.propertyAddress) {
      const addressString = [
        data.propertyAddress.houseNo,
        data.propertyAddress.street,
        addressContext.commune?.nameEn,
        addressContext.district?.nameEn,
        addressContext.province?.nameEn,
        "Cambodia",
      ]
        .filter(Boolean)
        .join(", ");

      console.log("Geocoding address:", addressString);

      try {
        const geocoded = await googleMapService.geocodeAddress(addressString);
        if (geocoded?.latitude && geocoded?.longitude) {
          return {
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
            googlePoint: `POINT(${geocoded.longitude} ${geocoded.latitude})`,
            geolocationLink: truncateString(
              googleMapService.getGoogleMapLink(geocoded.latitude, geocoded.longitude),
              500
            ),
            polygon: normalizedPolygon,
            formattedAddress: truncateString(geocoded.formattedAddress, 255),
            placeId: truncateString(geocoded.placeId, 100),
          };
        }

        console.warn("Geocoding returned no results:", addressString);
      } catch (error) {
        console.error("Geocoding failed:", error);
      }
    }

    return null;
  };

  const buildUpdateLocationData = async (
    data: any,
    _addressContext: AddressContext,
    helpers: LocationHelpers
  ) => {
    const { normalizePolygonData, calculatePolygonCentroid, truncateString } = helpers;

    // Update path must never geocode. We only persist what the caller provides,
    // deriving centroid from polygon when needed.
    if (!data.propertyLocation) return null;

    const normalizedPolygon = data.propertyLocation?.polygon
      ? normalizePolygonData(data.propertyLocation.polygon)
      : data.propertyLocation?.polygon === null
        ? null
        : undefined;

    const hasExplicitCoordinates =
      data.propertyLocation?.latitude !== undefined &&
      data.propertyLocation?.latitude !== null &&
      data.propertyLocation?.longitude !== undefined &&
      data.propertyLocation?.longitude !== null &&
      !isNaN(Number(data.propertyLocation.latitude)) &&
      !isNaN(Number(data.propertyLocation.longitude));

    let nextLatitude: number | undefined;
    let nextLongitude: number | undefined;

    if (hasExplicitCoordinates) {
      nextLatitude = Number(data.propertyLocation.latitude);
      nextLongitude = Number(data.propertyLocation.longitude);
    } else if (normalizedPolygon && normalizedPolygon.type === "Polygon") {
      const centroid = calculatePolygonCentroid(normalizedPolygon);
      if (centroid) {
        nextLatitude = centroid.latitude;
        nextLongitude = centroid.longitude;
      }
    }

    const updateData: Record<string, any> = {};

    if (normalizedPolygon !== undefined) {
      updateData.polygon = normalizedPolygon;
    }

    if (nextLatitude !== undefined && nextLongitude !== undefined) {
      updateData.latitude = nextLatitude;
      updateData.longitude = nextLongitude;
      updateData.googlePoint = `POINT(${nextLongitude} ${nextLatitude})`;
      updateData.geolocationLink = truncateString(
        googleMapService.getGoogleMapLink(nextLatitude, nextLongitude),
        500
      );
    } else if (typeof data.propertyLocation?.geolocationLink === "string") {
      updateData.geolocationLink = truncateString(data.propertyLocation.geolocationLink, 500);
    }

    if (typeof data.propertyLocation?.formattedAddress === "string") {
      updateData.formattedAddress = truncateString(data.propertyLocation.formattedAddress, 255);
    }
    if (typeof data.propertyLocation?.placeId === "string") {
      updateData.placeId = truncateString(data.propertyLocation.placeId, 100);
    }

    return Object.keys(updateData).length > 0 ? updateData : null;
  };

  return {
    validateAddressCodes,
    getAddressContext,
    buildCreateLocationData,
    buildUpdateLocationData,
  };
};
