import axiosInstance from "@/lib/api";
import {
  Province,
  District,
  Commune,
  Village,
  PropertyAddressResponse,
  ResolvePropertyAddressPayload,
  ResolvedPropertyAddress,
} from "@/types/propertyAddress.types";

const normalizeCode = (code: string | null | undefined): string => {
  return (code ?? "").trim();
};

const LOOKUP_CACHE_TTL_MS = 1000 * 60 * 60;
const RESOLVE_CACHE_TTL_MS = 1000 * 60 * 5;
const MAX_RESOLVE_CACHE_ENTRIES = 200;

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const provinceCache = new Map<string, CacheEntry<Province[]>>();
const districtCache = new Map<string, CacheEntry<District[]>>();
const communeCache = new Map<string, CacheEntry<Commune[]>>();
const villageCache = new Map<string, CacheEntry<Village[]>>();
const resolveCache = new Map<string, CacheEntry<ResolvedPropertyAddress>>();

const inflightRequests = new Map<string, Promise<unknown>>();

const cloneCachedValue = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const getCachedValue = <T>(cache: Map<string, CacheEntry<T>>, key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cloneCachedValue(entry.data);
};

const setCachedValue = <T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  data: T,
  ttlMs: number
) => {
  cache.set(key, {
    data: cloneCachedValue(data),
    expiresAt: Date.now() + ttlMs,
  });
};

const trimOldestEntries = <T>(cache: Map<string, CacheEntry<T>>, maxEntries: number) => {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) return;
    cache.delete(oldestKey);
  }
};

const getOrLoadCached = async <T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  maxEntries?: number
): Promise<T> => {
  const cached = getCachedValue(cache, key);
  if (cached !== null) {
    return cached;
  }

  const inflightKey = `cache:${key}`;
  const existingInflight = inflightRequests.get(inflightKey) as Promise<T> | undefined;
  if (existingInflight) {
    return cloneCachedValue(await existingInflight);
  }

  const request = (async () => {
    const data = await fetcher();
    setCachedValue(cache, key, data, ttlMs);
    if (typeof maxEntries === "number") {
      trimOldestEntries(cache, maxEntries);
    }
    return data;
  })();

  inflightRequests.set(inflightKey, request);

  try {
    return cloneCachedValue(await request);
  } finally {
    inflightRequests.delete(inflightKey);
  }
};

const normalizeAddressValue = (value: string | undefined): string => {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
};

const buildResolveCacheKey = (payload: ResolvePropertyAddressPayload): string => {
  const hasCoordinates =
    typeof payload.latitude === "number" && typeof payload.longitude === "number";

  if (hasCoordinates) {
    return `resolve:coords:${payload.latitude!.toFixed(6)}:${payload.longitude!.toFixed(6)}`;
  }

  return `resolve:address:${normalizeAddressValue(payload.formattedAddress)}`;
};

export const propertyAddressService = {
  // Get all provinces
  getAllProvinces: async (): Promise<Province[]> => {
    return getOrLoadCached(
      provinceCache,
      "provinces",
      LOOKUP_CACHE_TTL_MS,
      async () => {
        const response = await axiosInstance.get<PropertyAddressResponse<Province[]>>(
          "/property-address/provinces"
        );
        return response.data.data;
      }
    );
  },

  // Get all districts by province code
  getAllDistrictsByProvinceCode: async (
    provinceCode: string
  ): Promise<District[]> => {
    const code = normalizeCode(provinceCode);
    if (!code) return [];

    return getOrLoadCached(
      districtCache,
      `districts:${code}`,
      LOOKUP_CACHE_TTL_MS,
      async () => {
        const response = await axiosInstance.get<PropertyAddressResponse<District[]>>(
          `/property-address/provinces/${encodeURIComponent(code)}/districts`
        );
        return response.data.data;
      }
    );
  },

  // Get all communes by district code
  getAllCommunesByDistrictCode: async (
    districtCode: string
  ): Promise<Commune[]> => {
    const code = normalizeCode(districtCode);
    if (!code) return [];

    return getOrLoadCached(
      communeCache,
      `communes:${code}`,
      LOOKUP_CACHE_TTL_MS,
      async () => {
        const response = await axiosInstance.get<PropertyAddressResponse<Commune[]>>(
          `/property-address/districts/${encodeURIComponent(code)}/communes`
        );
        return response.data.data;
      }
    );
  },

  // Get all villages by commune code
  getAllVillagesByCommuneCode: async (
    communeCode: string
  ): Promise<Village[]> => {
    const code = normalizeCode(communeCode);
    if (!code) return [];

    return getOrLoadCached(
      villageCache,
      `villages:${code}`,
      LOOKUP_CACHE_TTL_MS,
      async () => {
        const response = await axiosInstance.get<PropertyAddressResponse<Village[]>>(
          `/property-address/communes/${encodeURIComponent(code)}/villages`
        );
        return response.data.data;
      }
    );
  },

  resolveAddress: async (
    payload: ResolvePropertyAddressPayload
  ): Promise<ResolvedPropertyAddress> => {
    const cacheKey = buildResolveCacheKey(payload);

    return getOrLoadCached(
      resolveCache,
      cacheKey,
      RESOLVE_CACHE_TTL_MS,
      async () => {
        const response = await axiosInstance.post<
          PropertyAddressResponse<ResolvedPropertyAddress>
        >("/property-address/resolve", payload);
        return response.data.data;
      },
      MAX_RESOLVE_CACHE_ENTRIES
    );
  },
};
