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

export const propertyAddressService = {
  // Get all provinces
  getAllProvinces: async (): Promise<Province[]> => {
    const response = await axiosInstance.get<PropertyAddressResponse<Province[]>>(
      "/property-address/provinces"
    );
    return response.data.data;
  },

  // Get all districts by province code
  getAllDistrictsByProvinceCode: async (
    provinceCode: string
  ): Promise<District[]> => {
    const code = normalizeCode(provinceCode);
    if (!code) return [];

    const response = await axiosInstance.get<PropertyAddressResponse<District[]>>(
     `/property-address/provinces/${encodeURIComponent(code)}/districts`
    );
    return response.data.data;
  },

  // Get all communes by district code
  getAllCommunesByDistrictCode: async (
    districtCode: string
  ): Promise<Commune[]> => {
    const code = normalizeCode(districtCode);
    if (!code) return [];

    const response = await axiosInstance.get<PropertyAddressResponse<Commune[]>>(
      `/property-address/districts/${encodeURIComponent(code)}/communes`
    );
    return response.data.data;
  },

  // Get all villages by commune code
  getAllVillagesByCommuneCode: async (
    communeCode: string
  ): Promise<Village[]> => {
    const code = normalizeCode(communeCode);
    if (!code) return [];

    const response = await axiosInstance.get<PropertyAddressResponse<Village[]>>(
      `/property-address/communes/${encodeURIComponent(code)}/villages`
    );
    return response.data.data;
  },

  resolveAddress: async (
    payload: ResolvePropertyAddressPayload
  ): Promise<ResolvedPropertyAddress> => {
    const response = await axiosInstance.post<
      PropertyAddressResponse<ResolvedPropertyAddress>
    >("/property-address/resolve", payload);
    return response.data.data;
  },
};
