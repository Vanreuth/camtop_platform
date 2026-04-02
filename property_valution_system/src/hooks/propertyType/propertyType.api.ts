import api from "@/lib/api";
import { unwrap } from "@/utils/helpers";
import type { PropertyType } from "@/types/property.types";

const PROPERTY_TYPE_PATH = "/propertytype";

const extractPropertyTypes = (payload: any): PropertyType[] => {
  const list =
    payload?.propertyType ??
    payload?.propertyTypes ??
    payload?.data?.propertyType ??
    payload?.data?.propertyTypes ??
    payload;

  return Array.isArray(list) ? list : [];
};

export const propertyTypeApi = {
  getPropertyTypes: async (): Promise<PropertyType[]> => {
    const response = await api.get(PROPERTY_TYPE_PATH);
    const payload = unwrap<any>(response.data);
    return extractPropertyTypes(payload);
  },
};
