import { propertyAddressService } from "@/hooks/propertyAddress/propertyAddress.service";
import type {
  Commune,
  ResolvedAddressItem,
  Village,
} from "@/types/propertyAddress.types";

type AddressLookupItem = ResolvedAddressItem | Commune | Village;
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

const pickFirstNonEmpty = (...values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }

  return null;
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
    .filter(Boolean);

  const extractLabeledTerm = (pattern: RegExp): string | null => {
    const match = normalizedInput.match(pattern);
    return pickFirstNonEmpty(match?.[1], match?.[2]);
  };

  const province =
    extractLabeledTerm(/(?:^|,)\s*(?:province|city|krong)\s+([^,]+)|([^,]+?)\s+(?:province|city|krong)(?=,|$)/iu) ??
    segments[segments.length - 1] ??
    null;
  const district =
    extractLabeledTerm(/(?:^|,)\s*(?:khan|district)\s+([^,]+)|([^,]+?)\s+(?:khan|district)(?=,|$)/iu) ??
    segments[segments.length - 2] ??
    null;
  const commune =
    extractLabeledTerm(/(?:^|,)\s*(?:sangkat|commune)\s+([^,]+)|([^,]+?)\s+(?:sangkat|commune)(?=,|$)/iu) ??
    segments[segments.length - 3] ??
    null;
  const village =
    extractLabeledTerm(/(?:^|,)\s*(?:village|phum)\s+([^,]+)|([^,]+?)\s+(?:village|phum)(?=,|$)/iu) ??
    segments[segments.length - 4] ??
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

export const completeResolvedHierarchyFromDetectedAddress = async <T extends ResolvedAddressDraft>(
  resolved: T,
  typedAddress: string
): Promise<T> => {
  const normalizedTypedAddress = typedAddress.trim();
  if (!normalizedTypedAddress || !resolved.districtId) {
    return resolved;
  }

  const levelTerms = extractHierarchyTermsFromAddress(normalizedTypedAddress);
  const nextResolved = { ...resolved };

  if (nextResolved.districtId && (nextResolved.communeId || levelTerms.commune)) {
    const communes = await propertyAddressService.getAllCommunesByDistrictCode(
      nextResolved.districtId
    );
    let matchedCommune =
      communes.find((commune) => commune.code === nextResolved.communeId) ?? null;

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
