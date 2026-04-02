import { useLocale } from "next-intl";
import { useMemo, useCallback } from "react";
import {
  type Locale,
  type LocalizedEntity,
  getLocalizedName,
  getProvinceName,
  getDistrictName,
  getCommuneName,
  getVillageName,
  formatFullAddress,
  getShortAddress,
} from "@/utils/addressLocale";

/**
 * Hook for locale-based address name formatting
 * Returns utility functions that automatically use the current locale
 */
export function useAddressLocale() {
  const currentLocale = useLocale();
  const locale: Locale = currentLocale === "kh" || currentLocale === "km" ? "kh" : "en";

  const getName = useCallback(
    (entity: LocalizedEntity | null | undefined, fallbackKey?: keyof LocalizedEntity) => {
      return getLocalizedName(entity, locale, fallbackKey);
    },
    [locale]
  );

  const province = useCallback(
    (entity: LocalizedEntity | null | undefined) => {
      return getProvinceName(entity, locale);
    },
    [locale]
  );

  const district = useCallback(
    (entity: LocalizedEntity | null | undefined) => {
      return getDistrictName(entity, locale);
    },
    [locale]
  );

  const commune = useCallback(
    (entity: LocalizedEntity | null | undefined) => {
      return getCommuneName(entity, locale);
    },
    [locale]
  );

  const village = useCallback(
    (entity: LocalizedEntity | null | undefined) => {
      return getVillageName(entity, locale);
    },
    [locale]
  );

  const fullAddress = useCallback(
    (
      address: Parameters<typeof formatFullAddress>[0],
      options?: Parameters<typeof formatFullAddress>[2]
    ) => {
      return formatFullAddress(address, locale, options);
    },
    [locale]
  );

  const shortAddress = useCallback(
    (address: Parameters<typeof getShortAddress>[0]) => {
      return getShortAddress(address, locale);
    },
    [locale]
  );

  return useMemo(
    () => ({
      locale,
      getName,
      province,
      district,
      commune,
      village,
      fullAddress,
      shortAddress,
    }),
    [locale, getName, province, district, commune, village, fullAddress, shortAddress]
  );
}

export type UseAddressLocaleReturn = ReturnType<typeof useAddressLocale>;
