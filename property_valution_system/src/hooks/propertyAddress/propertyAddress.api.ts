import { propertyAddressService } from "@/hooks/propertyAddress/propertyAddress.service";

export const propertyAddressApi = {
  getProvinces: () => propertyAddressService.getAllProvinces(),
  getDistrictsByProvinceCode: (provinceCode: string) =>
    propertyAddressService.getAllDistrictsByProvinceCode(provinceCode),
  getCommunesByDistrictCode: (districtCode: string) =>
    propertyAddressService.getAllCommunesByDistrictCode(districtCode),
  getVillagesByCommuneCode: (communeCode: string) =>
    propertyAddressService.getAllVillagesByCommuneCode(communeCode),
  resolveAddress: propertyAddressService.resolveAddress,
};
