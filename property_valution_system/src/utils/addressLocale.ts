/**
 * Utility functions for locale-based address name formatting
 * Used to display nameKh for Khmer locale and nameEn for English locale
 */

export type Locale = "kh" | "en";

export interface LocalizedEntity {
  nameKh?: string | null;
  nameEn?: string | null;
  // Fallback names
  provinceName?: string | null;
  districtName?: string | null;
  communeName?: string | null;
  villageName?: string | null;
}

/**
 * Get the localized name based on the current locale
 * @param entity - Object containing nameKh and nameEn
 * @param locale - Current locale ('kh' or 'en')
 * @param fallbackKey - Optional fallback key like 'provinceName'
 * @returns The localized name string
 */
export function getLocalizedName(
  entity: LocalizedEntity | null | undefined,
  locale: Locale,
  fallbackKey?: keyof LocalizedEntity
): string {
  if (!entity) return "";
  
  if (locale === "kh") {
    return entity.nameKh || entity.nameEn || (fallbackKey ? entity[fallbackKey] as string : "") || "";
  }
  
  return entity.nameEn || entity.nameKh || (fallbackKey ? entity[fallbackKey] as string : "") || "";
}

/**
 * Get localized province name
 */
export function getProvinceName(
  province: LocalizedEntity | null | undefined,
  locale: Locale
): string {
  return getLocalizedName(province, locale, "provinceName");
}

/**
 * Get localized district name
 */
export function getDistrictName(
  district: LocalizedEntity | null | undefined,
  locale: Locale
): string {
  return getLocalizedName(district, locale, "districtName");
}

/**
 * Get localized commune name
 */
export function getCommuneName(
  commune: LocalizedEntity | null | undefined,
  locale: Locale
): string {
  return getLocalizedName(commune, locale, "communeName");
}

/**
 * Get localized village name
 */
export function getVillageName(
  village: LocalizedEntity | null | undefined,
  locale: Locale
): string {
  return getLocalizedName(village, locale, "villageName");
}

/**
 * Format full address with all components
 */
export function formatFullAddress(
  address: {
    province?: LocalizedEntity | null;
    district?: LocalizedEntity | null;
    commune?: LocalizedEntity | null;
    village?: LocalizedEntity | null;
    street?: string | null;
    houseNo?: string | null;
  } | null | undefined,
  locale: Locale,
  options?: {
    includeVillage?: boolean;
    includeStreet?: boolean;
    separator?: string;
  }
): string {
  if (!address) return "";
  
  const {
    includeVillage = true,
    includeStreet = true,
    separator = ", ",
  } = options || {};
  
  const parts: string[] = [];
  
  if (includeStreet && address.houseNo) {
    parts.push(address.houseNo);
  }
  if (includeStreet && address.street) {
    parts.push(address.street);
  }
  if (includeVillage && address.village) {
    const villageName = getVillageName(address.village, locale);
    if (villageName) parts.push(villageName);
  }
  
  const communeName = getCommuneName(address.commune, locale);
  if (communeName) parts.push(communeName);
  
  const districtName = getDistrictName(address.district, locale);
  if (districtName) parts.push(districtName);
  
  const provinceName = getProvinceName(address.province, locale);
  if (provinceName) parts.push(provinceName);
  
  return parts.join(separator);
}

/**
 * Get short address (province, district)
 */
export function getShortAddress(
  address: {
    province?: LocalizedEntity | null;
    district?: LocalizedEntity | null;
  } | null | undefined,
  locale: Locale
): string {
  if (!address) return "";
  
  const district = getDistrictName(address.district, locale);
  const province = getProvinceName(address.province, locale);
  
  if (district && province) {
    return `${district}, ${province}`;
  }
  
  return province || district || "";
}
