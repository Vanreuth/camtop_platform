import { Client } from "@googlemaps/google-maps-services-js";
import { config } from "../config";

// Initialize Google Maps Client
const googleMapsClient = new Client({});
const apiKey = config.googleMaps.geocodingApiKey;

const getApiKey = (): string => {
  if (!apiKey) {
    throw new Error("GOOGLE_GEOCODING_API_KEY is not configured");
  }
  return apiKey;
};

const PLUS_CODE_PATTERN =
  /\b([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3})\b/i;

const extractPlusCode = (value: string): string | null => {
  const match = value.match(PLUS_CODE_PATTERN);
  return match?.[1]?.toUpperCase() ?? null;
};

const extractPlusCodeLocality = (value: string): string | null => {
  const plusCode = extractPlusCode(value);
  if (!plusCode) return null;

  const locality = value
    .replace(PLUS_CODE_PATTERN, " ")
    .replace(/[,\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return locality || null;
};

const normalizeGeocodeQuery = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const plusCode = extractPlusCode(trimmed);
  if (!plusCode) return trimmed;

  const locality = extractPlusCodeLocality(trimmed);
  const queryParts = [plusCode, locality, "Cambodia"].filter(Boolean);
  return queryParts.join(", ");
};

const KHMER_CHAR_PATTERN = /[\u1780-\u17FF]/;
const KHMER_DIGIT_MAP: Record<string, string> = {
  "០": "0",
  "១": "1",
  "២": "2",
  "៣": "3",
  "៤": "4",
  "៥": "5",
  "៦": "6",
  "៧": "7",
  "៨": "8",
  "៩": "9",
};

const normalizeKhmerDigits = (value: string): string =>
  value.replace(/[០-៩]/g, (digit) => KHMER_DIGIT_MAP[digit] ?? digit);

const normalizeForMatch = (value: string): string =>
  normalizeKhmerDigits(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenizeAddress = (value: string): string[] => {
  return normalizeForMatch(value)
    .split(" ")
    .filter((token) => token.length >= 2);
};

const buildLocationBiasBounds = (
  viewport?: {
    northeast?: { lat?: number; lng?: number };
    southwest?: { lat?: number; lng?: number };
  } | null,
  location?: { lat?: number; lng?: number } | null
) => {
  const viewportNorthEast = viewport?.northeast;
  const viewportSouthWest = viewport?.southwest;

  if (
    viewportNorthEast?.lat != null &&
    viewportNorthEast?.lng != null &&
    viewportSouthWest?.lat != null &&
    viewportSouthWest?.lng != null
  ) {
    return {
      northeast: {
        lat: viewportNorthEast.lat,
        lng: viewportNorthEast.lng,
      },
      southwest: {
        lat: viewportSouthWest.lat,
        lng: viewportSouthWest.lng,
      },
    };
  }

  if (location?.lat != null && location?.lng != null) {
    const latPadding = 0.25;
    const lngPadding = 0.25;
    return {
      northeast: {
        lat: location.lat + latPadding,
        lng: location.lng + lngPadding,
      },
      southwest: {
        lat: location.lat - latPadding,
        lng: location.lng - lngPadding,
      },
    };
  }

  return undefined;
};

const extractStreetNumber = (value: string): string | null => {
  const normalized = normalizeKhmerDigits(value);
  const match = normalized.match(/\b(\d+[A-Z]?)\b/i);
  return match?.[1]?.toLowerCase() ?? null;
};

const extractRoadNumber = (value: string): string | null => {
  const normalized = normalizeKhmerDigits(value);
  const match = normalized.match(
    /(?:street|st|road|rd|blvd|boulevard|ផ្លូវ(?:លេខ)?|ផ្លូវ)\s*(?:លេខ)?\s*(\d+[A-Z]?)/i
  );
  return match?.[1]?.toLowerCase() ?? null;
};

const buildResultSearchText = (result: any): string => {
  const parts = [
    result?.formatted_address,
    result?.plus_code?.compound_code,
    result?.plus_code?.global_code,
    ...(Array.isArray(result?.address_components)
      ? result.address_components.flatMap((component: any) => [
          component?.long_name,
          component?.short_name,
        ])
      : []),
  ].filter((value) => typeof value === "string" && value.trim().length > 0);

  return normalizeForMatch(parts.join(" "));
};

const scoreGeocodeResult = (
  result: any,
  inputAddress: string
): number => {
  let score = 0;
  const inputPlusCode = extractPlusCode(inputAddress);
  const inputPlusCodeLocality = extractPlusCodeLocality(inputAddress);
  const inputText = buildResultSearchText({ formatted_address: inputAddress });
  const resultText = buildResultSearchText(result);
  const inputTokens = tokenizeAddress(inputAddress);
  const localityTokens = inputPlusCodeLocality ? tokenizeAddress(inputPlusCodeLocality) : [];
  const streetNumber = extractStreetNumber(inputAddress);
  const roadNumber = extractRoadNumber(inputAddress);

  if (!result?.partial_match) {
    score += 20;
  }

  if (inputPlusCode) {
    const formattedAddress = String(result?.formatted_address ?? "").toUpperCase();
    const compoundCode = String(result?.plus_code?.compound_code ?? "").toUpperCase();
    const globalCode = String(result?.plus_code?.global_code ?? "").toUpperCase();

    if (formattedAddress.includes(inputPlusCode)) {
      score += 200;
    }

    if (compoundCode.includes(inputPlusCode)) {
      score += 250;
    }

    if (globalCode.endsWith(inputPlusCode.replace("+", ""))) {
      score += 250;
    }
  }

  if (streetNumber) {
    const matchedStreetNumber = Array.isArray(result?.address_components)
      ? result.address_components.find((component: any) =>
          Array.isArray(component?.types) &&
          component.types.includes("street_number")
        )?.long_name
      : null;
    if (normalizeForMatch(String(matchedStreetNumber ?? "")) === streetNumber) {
      score += 180;
    }
  }

  if (roadNumber) {
    const matchedRoute = Array.isArray(result?.address_components)
      ? result.address_components.find((component: any) =>
          Array.isArray(component?.types) &&
          component.types.includes("route")
        )?.long_name
      : null;
    if (normalizeForMatch(String(matchedRoute ?? "")).includes(roadNumber)) {
      score += 160;
    }
  }

  if (inputText && resultText.includes(inputText)) {
    score += 60;
  }

  if (inputPlusCode && localityTokens.length > 0) {
    const sharedLocalityTokens = localityTokens.filter((token) =>
      resultText.includes(token)
    ).length;

    if (sharedLocalityTokens === localityTokens.length) {
      score += 220;
    } else if (sharedLocalityTokens > 0) {
      score += sharedLocalityTokens * 45;
    } else {
      score -= 220;
    }
  }

  for (const token of inputTokens) {
    if (resultText.includes(token)) {
      score += 12;
    }
  }

  return score;
};

const matchesPlusCodeLocality = (result: any, inputAddress: string): boolean => {
  const plusCode = extractPlusCode(inputAddress);
  const plusCodeLocality = extractPlusCodeLocality(inputAddress);

  if (!plusCode || !plusCodeLocality) {
    return true;
  }

  const localityTokens = tokenizeAddress(plusCodeLocality);
  if (!localityTokens.length) {
    return true;
  }

  const resultText = buildResultSearchText(result);
  return localityTokens.every((token) => resultText.includes(token));
};

const selectBestGeocodeResult = (results: any[], address: string) => {
  if (!results.length) return null;

  return [...results].sort(
    (left, right) =>
      scoreGeocodeResult(right, address) -
      scoreGeocodeResult(left, address)
  )[0];
};

// Geocode an address to get latitude and longitude
const geocodeAddress = async (
  address: string
): Promise<{
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string;
}> => {
  try {
    const geocodeQuery = normalizeGeocodeQuery(address);
    const plusCodeLocality = extractPlusCodeLocality(address);
    let localityFallbackResult: any | null = null;
    let biasBounds:
      | {
          northeast: { lat: number; lng: number };
          southwest: { lat: number; lng: number };
        }
      | undefined;

    if (extractPlusCode(address) && plusCodeLocality) {
      try {
        const localityResponse = await googleMapsClient.geocode({
          params: {
            address: `${plusCodeLocality}, Cambodia`,
            region: "kh",
            language: KHMER_CHAR_PATTERN.test(plusCodeLocality) ? "km" : "en",
            components: {
              country: "KH",
            },
            key: getApiKey(),
          },
        });

        const localityResult = localityResponse.data.results[0];
        localityFallbackResult = localityResult ?? null;
        biasBounds = buildLocationBiasBounds(
          localityResult?.geometry?.viewport,
          localityResult?.geometry?.location
        );
      } catch {
        biasBounds = undefined;
      }
    }

    const response = await googleMapsClient.geocode({
      params: {
        address: geocodeQuery,
        ...(biasBounds ? { bounds: biasBounds } : {}),
        region: "kh",
        language: KHMER_CHAR_PATTERN.test(address) ? "km" : "en",
        components: {
          country: "KH",
        },
        key: getApiKey(),
      },
    });

    if (response.data.results.length === 0) {
      throw new Error("No results found");
    }

    let result = selectBestGeocodeResult(response.data.results, address);
    if (!result) {
      throw new Error("No suitable results found");
    }

    if (!matchesPlusCodeLocality(result, address) && localityFallbackResult) {
      result = localityFallbackResult;
    }

    const location = result.geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    };
  } catch (error) {
    throw new Error("Geocoding failed: " + (error as Error).message);
  }
};

// Reverse geocode coordinates to address
const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<{
  formattedAddress: string;
  addressComponents: any[];
  placeId: string;
} | null> => {
  try {
    const response = await googleMapsClient.reverseGeocode({
      params: {
        latlng: { lat: latitude, lng: longitude },
        key: getApiKey(),
      },
    });

    if (response.data.results.length === 0) {
      throw new Error("No results found");
    }

    const result = response.data.results[0];

    return {
      formattedAddress: result.formatted_address,
      addressComponents: result.address_components,
      placeId: result.place_id,
    };
  } catch (error) {
    throw new Error("Reverse geocoding failed: " + (error as Error).message);
  }
};

// Parse address components into structured format
const parseAddressComponents = (
  addressComponents: any[]
): {
  streetNumber?: string;
  route?: string;
  locality?: string;
  sublocality?: string;
  administrativeAreaLevel1?: string; // Province/State
  administrativeAreaLevel2?: string; // District
  administrativeAreaLevel3?: string; // Commune/Sangkat
  country?: string;
  postalCode?: string;
} => {
  const parsed: any = {};

  addressComponents.forEach((component) => {
    const types = component.types;

    if (types.includes("street_number")) {
      parsed.streetNumber = component.long_name;
    }
    if (types.includes("route")) {
      parsed.route = component.long_name;
    }
    if (types.includes("locality")) {
      parsed.locality = component.long_name;
    }
    if (
      types.includes("sublocality") ||
      types.includes("sublocality_level_1")
    ) {
      parsed.sublocality = component.long_name;
    }
    if (types.includes("administrative_area_level_1")) {
      parsed.administrativeAreaLevel1 = component.long_name; // Province
    }
    if (types.includes("administrative_area_level_2")) {
      parsed.administrativeAreaLevel2 = component.long_name; // District
    }
    if (types.includes("administrative_area_level_3")) {
      parsed.administrativeAreaLevel3 = component.long_name; // Commune
    }
    if (types.includes("country")) {
      parsed.country = component.long_name;
    }
    if (types.includes("postal_code")) {
      parsed.postalCode = component.long_name;
    }
  });

  return parsed;
};

// Get address from map click (coordinates)
const getAddressFromCoordinates = async (
  latitude: number,
  longitude: number
): Promise<{
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId: string;
  streetNumber?: string;
  route?: string;
  locality?: string;
  sublocality?: string;
  province?: string;
  district?: string;
  commune?: string;
  country?: string;
  postalCode?: string;
  googleMapLink: string;
} | null> => {
  try {
    const reverseGeocoded = await reverseGeocode(latitude, longitude);

    if (!reverseGeocoded) {
      return null;
    }

    const parsed = parseAddressComponents(reverseGeocoded.addressComponents);

    return {
      latitude,
      longitude,
      formattedAddress: reverseGeocoded.formattedAddress,
      placeId: reverseGeocoded.placeId,
      streetNumber: parsed.streetNumber,
      route: parsed.route,
      locality: parsed.locality,
      sublocality: parsed.sublocality,
      province: parsed.administrativeAreaLevel1,
      district: parsed.administrativeAreaLevel2,
      commune: parsed.administrativeAreaLevel3,
      country: parsed.country,
      postalCode: parsed.postalCode,
      googleMapLink: getGoogleMapLink(latitude, longitude),
    };
  } catch (error) {
    console.error("Error getting address from coordinates:", error);
    return null;
  }
};

// Get Google Map Link from coordinates
const getGoogleMapLink = (latitude: number, longitude: number): string => {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
};

// Calulate distance between two coordinates in meters

const calculateDistance = async (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<number | null> => {
  try {
    const response = await googleMapsClient.distancematrix({
      params: {
        origins: [`${origin.lat},${origin.lng}`],
        destinations: [`${destination.lat},${destination.lng}`],
        key: getApiKey(),
      },
    });

    const element = response.data.rows[0]?.elements[0];
    if (element?.status === "OK") {
      return element.distance.value / 1000; // Convert meters to km
    }
    return null;
  } catch (error) {
    console.error("Distance calculation error:", error);
    return null;
  }
};

export type GeoJSONPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};



export const googleMapService = {
  geocodeAddress,
  reverseGeocode,
  parseAddressComponents,
  getAddressFromCoordinates,
  getGoogleMapLink,
  calculateDistance,
};
