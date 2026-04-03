import { propertyAddressService } from "@/hooks/propertyAddress/propertyAddress.service";
import type {
  District,
  Commune,
  Province,
  ResolvedAddressItem,
  Village,
} from "@/types/propertyAddress.types";

type AddressLookupItem = ResolvedAddressItem | Province | District | Commune | Village;
type AddressEntityLike = {
  code?: string | number | null;
  provinceId?: string | number | null;
  districtId?: string | number | null;
  communeId?: string | number | null;
  villageId?: string | number | null;
  nameEn?: string | null;
  nameKh?: string | null;
  provinceName?: string | null;
  districtName?: string | null;
  communeName?: string | null;
  villageName?: string | null;
} | null | undefined;
const PLUS_CODE_PATTERN =
  /\b([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3})\b/giu;

export type ResolvedAddressDraft = {
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  resolvedFormattedAddress: string | null;
  placeId: string | null;
  street: string | null;
  houseNumber: string | null;
  provinceId: string | null;
  districtId: string | null;
  communeId: string | null;
  villageId: string | null;
  googleMapLink?: string | null;
  province?: ResolvedAddressItem | null;
  district?: ResolvedAddressItem | null;
  commune?: ResolvedAddressItem | null;
  village?: ResolvedAddressItem | null;
};

const normalizeAddressLookupText = (value: string | null | undefined): string => {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(PLUS_CODE_PATTERN, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeHierarchyTerm = (value: string | null | undefined): string => {
  return normalizeAddressLookupText(value)
    .replace(/\b(village|phum|sangkat|commune|khan|district|province|city|krong)\b/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const compactHierarchyTerm = (value: string | null | undefined): string => {
  return normalizeHierarchyTerm(value).replace(/\s+/g, "");
};

const COUNTRY_SEGMENTS = new Set(["cambodia", "kingdom of cambodia", "kampuchea"]);

const pickFirstNonEmpty = (...values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }

  return null;
};

export const getAddressEntityCode = (entity: AddressEntityLike): string | null => {
  const value =
    entity?.code ??
    entity?.provinceId ??
    entity?.districtId ??
    entity?.communeId ??
    entity?.villageId;

  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

export const toResolvedAddressItem = (
  entity: AddressEntityLike
): ResolvedAddressItem | null => {
  const code = getAddressEntityCode(entity);
  if (!code) {
    return null;
  }

  return {
    code,
    nameEn:
      entity?.nameEn ??
      entity?.provinceName ??
      entity?.districtName ??
      entity?.communeName ??
      entity?.villageName ??
      "",
    nameKh: entity?.nameKh ?? "",
  };
};

const extractHierarchyTermsFromAddress = (value: string | null | undefined) => {
  const input = value?.trim() ?? "";
  if (!input) {
    return {
      province: null,
      district: null,
      commune: null,
      village: null,
    };
  }

  const normalizedInput = input.replace(PLUS_CODE_PATTERN, " ").replace(/\s+/g, " ").trim();

  const segments = normalizedInput
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !COUNTRY_SEGMENTS.has(normalizeAddressLookupText(segment)));

  const extractLabeledTerm = (pattern: RegExp): string | null => {
    const match = normalizedInput.match(pattern);
    return pickFirstNonEmpty(match?.[1], match?.[2]);
  };

  const fallbackProvince = segments[segments.length - 1] ?? null;
  const fallbackDistrict = segments.length >= 3 ? segments[segments.length - 2] : null;
  const fallbackCommune = segments.length >= 4 ? segments[segments.length - 3] : null;
  const fallbackVillage = segments.length >= 5 ? segments[segments.length - 4] : null;

  const province =
    extractLabeledTerm(/(?:^|,)\s*(?:province|city|krong)\s+([^,]+)|([^,]+?)\s+(?:province|city|krong)(?=,|$)/iu) ??
    fallbackProvince ??
    null;
  const district =
    extractLabeledTerm(/(?:^|,)\s*(?:khan|district)\s+([^,]+)|([^,]+?)\s+(?:khan|district)(?=,|$)/iu) ??
    fallbackDistrict ??
    null;
  const commune =
    extractLabeledTerm(/(?:^|,)\s*(?:sangkat|commune)\s+([^,]+)|([^,]+?)\s+(?:sangkat|commune)(?=,|$)/iu) ??
    fallbackCommune ??
    null;
  const village =
    extractLabeledTerm(/(?:^|,)\s*(?:village|phum)\s+([^,]+)|([^,]+?)\s+(?:village|phum)(?=,|$)/iu) ??
    fallbackVillage ??
    null;

  return { province, district, commune, village };
};

const findBestAddressLookupMatch = <T extends AddressLookupItem>(
  items: T[],
  term: string | null | undefined
): T | null => {
  const normalizedTerm = normalizeHierarchyTerm(term);
  const compactTerm = compactHierarchyTerm(term);
  if (!normalizedTerm) return null;

  let bestMatch: T | null = null;
  let bestScore = 0;

  for (const item of items) {
    const normalizedNameEn = normalizeHierarchyTerm(item.nameEn);
    const normalizedNameKh = normalizeHierarchyTerm(item.nameKh);
    const candidates = [normalizedNameEn, normalizedNameKh].filter(Boolean);

    let score = 0;
    for (const candidate of candidates) {
      if (!candidate) continue;

      const compactCandidate = candidate.replace(/\s+/g, "");

      if (candidate === normalizedTerm) {
        score = Math.max(score, 100);
      } else if (compactTerm && compactCandidate === compactTerm) {
        score = Math.max(score, 96);
      } else if (candidate.includes(normalizedTerm) || normalizedTerm.includes(candidate)) {
        score = Math.max(score, 85);
      } else if (
        compactTerm &&
        (compactCandidate.includes(compactTerm) || compactTerm.includes(compactCandidate))
      ) {
        score = Math.max(score, 82);
      } else {
        const candidateTokens = new Set(candidate.split(" ").filter(Boolean));
        const termTokens = normalizedTerm.split(" ").filter(Boolean);
        const sharedTokens = termTokens.filter((token) => candidateTokens.has(token)).length;

        if (sharedTokens > 0) {
          score = Math.max(
            score,
            Math.round((sharedTokens / Math.max(termTokens.length, candidateTokens.size)) * 80)
          );
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestScore >= 70 ? bestMatch : null;
};

export const ensureResolvedAddressHierarchy = async <T extends ResolvedAddressDraft>(
  resolved: T
): Promise<T> => {
  const nextResolved = { ...resolved };
  let provincesCache: Province[] | null = null;
  const districtsByProvince = new Map<string, District[]>();
  const communesByDistrict = new Map<string, Commune[]>();
  const villagesByCommune = new Map<string, Village[]>();

  const getProvinces = async () => {
    if (!provincesCache) {
      provincesCache = await propertyAddressService.getAllProvinces();
    }
    return provincesCache;
  };

  const getDistrictsByProvince = async (provinceCode: string) => {
    if (!districtsByProvince.has(provinceCode)) {
      districtsByProvince.set(
        provinceCode,
        await propertyAddressService.getAllDistrictsByProvinceCode(provinceCode)
      );
    }
    return districtsByProvince.get(provinceCode) ?? [];
  };

  const getCommunesByDistrict = async (districtCode: string) => {
    if (!communesByDistrict.has(districtCode)) {
      communesByDistrict.set(
        districtCode,
        await propertyAddressService.getAllCommunesByDistrictCode(districtCode)
      );
    }
    return communesByDistrict.get(districtCode) ?? [];
  };

  const getVillagesByCommune = async (communeCode: string) => {
    if (!villagesByCommune.has(communeCode)) {
      villagesByCommune.set(
        communeCode,
        await propertyAddressService.getAllVillagesByCommuneCode(communeCode)
      );
    }
    return villagesByCommune.get(communeCode) ?? [];
  };

  if (nextResolved.villageId) {
    let matchedVillage: Village | null = null;
    let matchedCommune: Commune | null = null;
    let matchedDistrict: District | null = null;
    let matchedProvince: Province | null = null;

    if (nextResolved.communeId) {
      const villages = await getVillagesByCommune(nextResolved.communeId);
      matchedVillage =
        villages.find((village) => village.code === nextResolved.villageId) ?? null;
    }

    if (!matchedVillage) {
      const provinces = nextResolved.provinceId
        ? (await getProvinces()).filter((province) => province.code === nextResolved.provinceId)
        : await getProvinces();

      for (const province of provinces) {
        const districts = await getDistrictsByProvince(province.code);
        for (const district of districts) {
          if (nextResolved.districtId && district.code !== nextResolved.districtId) continue;
          const communes = await getCommunesByDistrict(district.code);
          for (const commune of communes) {
            if (nextResolved.communeId && commune.code !== nextResolved.communeId) continue;
            const villages = await getVillagesByCommune(commune.code);
            const village = villages.find((item) => item.code === nextResolved.villageId);
            if (village) {
              matchedVillage = village;
              matchedCommune = commune;
              matchedDistrict = district;
              matchedProvince = province;
              break;
            }
          }
          if (matchedVillage) break;
        }
        if (matchedVillage) break;
      }
    }

    if (matchedVillage) {
      nextResolved.villageId = matchedVillage.code;
      nextResolved.village = matchedVillage;
      nextResolved.communeId = matchedVillage.communeCode;

      if (!matchedCommune) {
        if (nextResolved.districtId) {
          const communes = await getCommunesByDistrict(nextResolved.districtId);
          matchedCommune =
            communes.find((commune) => commune.code === matchedVillage!.communeCode) ?? null;
        }

        if (!matchedCommune) {
          const provinces = nextResolved.provinceId
            ? (await getProvinces()).filter((province) => province.code === nextResolved.provinceId)
            : await getProvinces();

          for (const province of provinces) {
            const districts = await getDistrictsByProvince(province.code);
            for (const district of districts) {
              const communes = await getCommunesByDistrict(district.code);
              const commune = communes.find((item) => item.code === matchedVillage!.communeCode);
              if (commune) {
                matchedCommune = commune;
                matchedDistrict = district;
                matchedProvince = province;
                break;
              }
            }
            if (matchedCommune) break;
          }
        }
      }

      if (matchedCommune) {
        nextResolved.commune = matchedCommune;
        nextResolved.communeId = matchedCommune.code;
        nextResolved.districtId = matchedCommune.districtCode;
      }

      if (matchedDistrict) {
        nextResolved.district = matchedDistrict;
        nextResolved.districtId = matchedDistrict.code;
        nextResolved.provinceId = matchedDistrict.provinceCode;
      }

      if (matchedProvince) {
        nextResolved.province = matchedProvince;
        nextResolved.provinceId = matchedProvince.code;
      }
    }
  }

  if (nextResolved.communeId) {
    let matchedCommune: Commune | null = null;
    let matchedDistrict: District | null = null;
    let matchedProvince: Province | null = null;

    if (nextResolved.districtId) {
      const communes = await getCommunesByDistrict(nextResolved.districtId);
      matchedCommune =
        communes.find((commune) => commune.code === nextResolved.communeId) ?? matchedCommune;
    }

    if (!matchedCommune) {
      const provinces = nextResolved.provinceId
        ? (await getProvinces()).filter((province) => province.code === nextResolved.provinceId)
        : await getProvinces();

      for (const province of provinces) {
        const districts = await getDistrictsByProvince(province.code);
        for (const district of districts) {
          if (nextResolved.districtId && district.code !== nextResolved.districtId) continue;
          const communes = await getCommunesByDistrict(district.code);
          const commune = communes.find((item) => item.code === nextResolved.communeId);
          if (commune) {
            matchedCommune = commune;
            matchedDistrict = district;
            matchedProvince = province;
            break;
          }
        }
        if (matchedCommune) break;
      }
    }

    if (matchedCommune) {
      nextResolved.communeId = matchedCommune.code;
      nextResolved.commune = matchedCommune;
      nextResolved.districtId = matchedCommune.districtCode;

      if (!matchedDistrict) {
        const provinces = nextResolved.provinceId
          ? (await getProvinces()).filter((province) => province.code === nextResolved.provinceId)
          : await getProvinces();

        for (const province of provinces) {
          const districts = await getDistrictsByProvince(province.code);
          const district = districts.find((item) => item.code === matchedCommune!.districtCode);
          if (district) {
            matchedDistrict = district;
            matchedProvince = province;
            break;
          }
        }
      }

      if (matchedDistrict) {
        nextResolved.district = matchedDistrict;
        nextResolved.districtId = matchedDistrict.code;
        nextResolved.provinceId = matchedDistrict.provinceCode;
      }

      if (!matchedProvince && nextResolved.provinceId) {
        matchedProvince =
          (await getProvinces()).find((province) => province.code === nextResolved.provinceId) ?? null;
      }

      if (matchedProvince) {
        nextResolved.province = matchedProvince;
        nextResolved.provinceId = matchedProvince.code;
      }
    }
  }

  if (nextResolved.districtId) {
    let matchedProvince: Province | null = null;
    let matchedDistrict: District | null = null;

    if (nextResolved.provinceId) {
      const districts = await getDistrictsByProvince(nextResolved.provinceId);
      matchedDistrict =
        districts.find((district) => district.code === nextResolved.districtId) ?? matchedDistrict;
      matchedProvince =
        matchedProvince ??
        (await getProvinces()).find((province) => province.code === nextResolved.provinceId) ??
        null;
    }

    if (!matchedDistrict) {
      const provinces = await getProvinces();
      for (const province of provinces) {
        const districts = await getDistrictsByProvince(province.code);
        const district = districts.find((item) => item.code === nextResolved.districtId);
        if (district) {
          matchedProvince = province;
          matchedDistrict = district;
          break;
        }
      }
    }

    if (matchedDistrict) {
      nextResolved.districtId = matchedDistrict.code;
      nextResolved.district = matchedDistrict;
      nextResolved.provinceId = matchedDistrict.provinceCode;
      nextResolved.province =
        matchedProvince ??
        (await getProvinces()).find((province) => province.code === matchedDistrict.provinceCode) ??
        null;
    }
  }

  if (nextResolved.provinceId && !nextResolved.province) {
    const provinces = await getProvinces();
    nextResolved.province =
      provinces.find((province) => province.code === nextResolved.provinceId) ?? null;
  }

  return nextResolved as T;
};

export const completeResolvedHierarchyFromDetectedAddress = async <T extends ResolvedAddressDraft>(
  resolved: T,
  typedAddress: string
): Promise<T> => {
  const normalizedTypedAddress = typedAddress.trim();
  if (!normalizedTypedAddress) {
    return ensureResolvedAddressHierarchy(resolved);
  }

  const levelTerms = extractHierarchyTermsFromAddress(normalizedTypedAddress);
  const nextResolved = await ensureResolvedAddressHierarchy(resolved);
  let provinces: Province[] | null = null;

  if (nextResolved.provinceId || levelTerms.province) {
    provinces = await propertyAddressService.getAllProvinces();
    let matchedProvince =
      provinces.find((province) => province.code === nextResolved.provinceId) ?? null;

    if (levelTerms.province) {
      matchedProvince =
        findBestAddressLookupMatch(provinces, levelTerms.province) ?? matchedProvince;
    }

    if (matchedProvince) {
      nextResolved.provinceId = matchedProvince.code;
      nextResolved.province = matchedProvince;
    } else if (levelTerms.province) {
      nextResolved.provinceId = null;
      nextResolved.province = null;
      nextResolved.districtId = null;
      nextResolved.district = null;
      nextResolved.communeId = null;
      nextResolved.commune = null;
      nextResolved.villageId = null;
      nextResolved.village = null;
    }
  }

  if (nextResolved.provinceId && (nextResolved.districtId || levelTerms.district)) {
    const districts = await propertyAddressService.getAllDistrictsByProvinceCode(
      nextResolved.provinceId
    );
    let matchedDistrict =
      districts.find((district) => district.code === nextResolved.districtId) ?? null;

    if (nextResolved.districtId && !matchedDistrict) {
      nextResolved.districtId = null;
      nextResolved.district = null;
      nextResolved.communeId = null;
      nextResolved.commune = null;
      nextResolved.villageId = null;
      nextResolved.village = null;
    }

    if (levelTerms.district) {
      matchedDistrict =
        findBestAddressLookupMatch(districts, levelTerms.district) ?? matchedDistrict;
    }

    if (matchedDistrict) {
      nextResolved.districtId = matchedDistrict.code;
      nextResolved.district = matchedDistrict;
      nextResolved.provinceId = matchedDistrict.provinceCode;

      if (!nextResolved.province && provinces) {
        nextResolved.province =
          provinces.find((province) => province.code === matchedDistrict.provinceCode) ?? null;
      }
    } else if (levelTerms.district) {
      nextResolved.districtId = null;
      nextResolved.district = null;
      nextResolved.communeId = null;
      nextResolved.commune = null;
      nextResolved.villageId = null;
      nextResolved.village = null;
    }
  } else if (levelTerms.district) {
    nextResolved.districtId = null;
    nextResolved.district = null;
    nextResolved.communeId = null;
    nextResolved.commune = null;
    nextResolved.villageId = null;
    nextResolved.village = null;
  }

  if (nextResolved.districtId && (nextResolved.communeId || levelTerms.commune)) {
    const communes = await propertyAddressService.getAllCommunesByDistrictCode(
      nextResolved.districtId
    );
    let matchedCommune =
      communes.find((commune) => commune.code === nextResolved.communeId) ?? null;

    if (nextResolved.communeId && !matchedCommune) {
      nextResolved.communeId = null;
      nextResolved.commune = null;
      nextResolved.villageId = null;
      nextResolved.village = null;
    }

    if (levelTerms.commune) {
      matchedCommune =
        findBestAddressLookupMatch(communes, levelTerms.commune) ?? matchedCommune;
    }

    if (matchedCommune) {
      nextResolved.communeId = matchedCommune.code;
      nextResolved.commune = matchedCommune;
    } else if (levelTerms.commune) {
      nextResolved.communeId = null;
      nextResolved.commune = null;
    }
  } else if (levelTerms.commune) {
    nextResolved.communeId = null;
    nextResolved.commune = null;
    nextResolved.villageId = null;
    nextResolved.village = null;
  }

  if (nextResolved.communeId) {
    const villages = await propertyAddressService.getAllVillagesByCommuneCode(
      nextResolved.communeId
    );

    if (nextResolved.villageId) {
      const villageStillMatches = villages.some(
        (village) => village.code === nextResolved.villageId
      );
      if (!villageStillMatches) {
        nextResolved.villageId = null;
        nextResolved.village = null;
      }
    }

    if (!nextResolved.villageId && levelTerms.village) {
      const matchedVillage = findBestAddressLookupMatch(villages, levelTerms.village);
      if (matchedVillage) {
        nextResolved.villageId = matchedVillage.code;
        nextResolved.village = matchedVillage;
      }
    }
  } else {
    nextResolved.villageId = null;
    nextResolved.village = null;
  }

  return nextResolved;
};
