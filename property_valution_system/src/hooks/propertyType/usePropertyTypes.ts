import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { PropertyTypes } from "@/constants/propertyTypesData";
import type { PropertyType } from "@/types/property.types";
import { propertyTypeApi } from "./propertyType.api";

const propertyTypeKeys = {
  all: ["property-types"] as const,
};

export function usePropertyTypes(): PropertyType[] {
  const t = useTranslations("properties");
  const fallbackTypes = useMemo(() => PropertyTypes((key) => t(key)), [t]);

  const { data } = useQuery({
    queryKey: propertyTypeKeys.all,
    queryFn: propertyTypeApi.getPropertyTypes,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });

  const fallbackBuildingSubtypes = useMemo(() => {
    const map = new Map<number, PropertyType["buildingSubtypes"]>();
    fallbackTypes.forEach((type) => {
      if (type.buildingSubtypes?.length) {
        map.set(type.propertyTypeId, type.buildingSubtypes);
      }
    });
    return map;
  }, [fallbackTypes]);

  return useMemo(() => {
    const base =
      Array.isArray(data) && data.length > 0 ? data : fallbackTypes;
    const sorted = [...base].sort(
      (a, b) => (a.propertyTypeId || 0) - (b.propertyTypeId || 0)
    );

    return sorted.map((type) => ({
      ...type,
      subtypes: Array.isArray(type.subtypes) ? type.subtypes : [],
      currentUses: Array.isArray(type.currentUses) ? type.currentUses : [],
      buildingSubtypes:
        Array.isArray(type.buildingSubtypes) && type.buildingSubtypes.length > 0
          ? type.buildingSubtypes
          : fallbackBuildingSubtypes.get(type.propertyTypeId) ?? [],
    }));
  }, [data, fallbackTypes, fallbackBuildingSubtypes]);
}
