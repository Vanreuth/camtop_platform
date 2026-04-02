import { useQuery } from "@tanstack/react-query";
import { propertyAddressApi } from "./propertyAddress.api";
import type {
  Province,
  District,
  Commune,
  Village,
} from "@/types/propertyAddress.types";

export const propertyAddressKeys = {
  all: ["property-address"] as const,
  provinces: () => [...propertyAddressKeys.all, "provinces"] as const,
  districts: (provinceCode?: string | null) =>
    [...propertyAddressKeys.all, "districts", provinceCode] as const,
  communes: (districtCode?: string | null) =>
    [...propertyAddressKeys.all, "communes", districtCode] as const,
  villages: (communeCode?: string | null) =>
    [...propertyAddressKeys.all, "villages", communeCode] as const,
};

export const useProvinces = () => {
  return useQuery<Province[], Error>({
    queryKey: propertyAddressKeys.provinces(),
    queryFn: () => propertyAddressApi.getProvinces(),
    staleTime: 1000 * 60 * 60 * 24,
    retry: false,
  });
};

export const useDistrictsByProvinceCode = (
  provinceCode: string | null | undefined
) => {
  return useQuery<District[], Error>({
    queryKey: propertyAddressKeys.districts(provinceCode),
    queryFn: () => propertyAddressApi.getDistrictsByProvinceCode(provinceCode!),
    enabled: !!provinceCode && provinceCode !== "",
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
};

export const useCommunesByDistrictCode = (
  districtCode: string | null | undefined
) => {
  return useQuery<Commune[], Error>({
    queryKey: propertyAddressKeys.communes(districtCode),
    queryFn: () => propertyAddressApi.getCommunesByDistrictCode(districtCode!),
    enabled: !!districtCode && districtCode !== "",
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
};

export const useVillagesByCommuneCode = (
  communeCode: string | null | undefined
) => {
  return useQuery<Village[], Error>({
    queryKey: propertyAddressKeys.villages(communeCode),
    queryFn: () => propertyAddressApi.getVillagesByCommuneCode(communeCode!),
    enabled: !!communeCode && communeCode !== "",
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
};
