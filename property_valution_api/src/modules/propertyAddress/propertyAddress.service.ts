import { BadRequestError } from "../../common/errors/badRequest.error";
import config from "../../config";
import { googleMapService } from "../../services/googleMap.service";
import { cacheService } from "../../services/cache/cache.service";
import { cacheKeys } from "../../services/cache/cacheKeys";
import {
	CommuneLookupRow,
	DistrictLookupRow,
	PropertyAddressRepository,
	ProvinceLookupRow,
	ResolvedAddressHierarchy,
	VillageLookupRow,
} from "./propertyAddress.repository";

type ResolvePropertyAddressInput = {
	latitude?: number;
	longitude?: number;
	formattedAddress?: string;
};

type AddressLookupEntity =
	| ProvinceLookupRow
	| DistrictLookupRow
	| CommuneLookupRow
	| VillageLookupRow;

type ReverseGeocodedAddress = {
	formattedAddress: string;
	placeId: string;
	streetNumber?: string;
	route?: string;
	locality?: string;
	sublocality?: string;
	village?: string;
	province?: string;
	district?: string;
	commune?: string;
	country?: string;
	postalCode?: string;
	googleMapLink: string;
};

const ADMIN_PREFIX_PATTERN =
	/\b(province|capital|municipality|district|commune|sangkat|village|phum|khan|krong|city)\b/gi;
const KHMER_ADMIN_PREFIX_PATTERN = /(ខេត្ត|រាជធានី|ស្រុក|ខណ្ឌ|ឃុំ|សង្កាត់|ភូមិ|ក្រុង)/g;
const COUNTRY_TERMS = new Set(["cambodia", "kingdom of cambodia", "កម្ពុជា"]);
const PLUS_CODE_PATTERN =
	/\b([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3})\b/giu;
const ADDRESS_LEVEL_PATTERNS = {
	province: [
		/\b(?:province|capital|municipality)\s+([^,]+)/i,
		/(?:ខេត្ត|រាជធានី)\s*([^,]+)/,
	],
	district: [
		/\b(?:district|khan|krong|city)\s+([^,]+)/i,
		/(?:ស្រុក|ខណ្ឌ|ក្រុង)\s*([^,]+)/,
	],
	commune: [
		/\b(?:commune|sangkat)\s+([^,]+)/i,
		/(?:ឃុំ|សង្កាត់)\s*([^,]+)/,
	],
	village: [
		/\b(?:village|phum)\s+([^,]+)/i,
		/ភូមិ\s*([^,]+)/,
	],
} as const;

const extractAddressLevelTerms = (value?: string | null) => {
	const result: {
		province?: string;
		district?: string;
		commune?: string;
		village?: string;
	} = {};

	if (!value) return result;
	const normalizedValue = value.replace(PLUS_CODE_PATTERN, " ").replace(/\s+/g, " ").trim();

	for (const [level, patterns] of Object.entries(ADDRESS_LEVEL_PATTERNS) as Array<
		[keyof typeof ADDRESS_LEVEL_PATTERNS, readonly RegExp[]]
	>) {
		for (const pattern of patterns) {
			const match = normalizedValue.match(pattern);
			const candidate = match?.[1]?.trim();
			if (candidate) {
				result[level] = candidate;
				break;
			}
		}
	}

	return result;
};

const splitAddressSegments = (value: string): string[] => {
	return value
		.replace(PLUS_CODE_PATTERN, ",")
		.replace(ADMIN_PREFIX_PATTERN, ",")
		.replace(KHMER_ADMIN_PREFIX_PATTERN, ",")
		.split(",")
		.map((segment) => segment.trim())
		.filter(Boolean);
};

const normalizeAddressText = (value?: string | null): string => {
	if (!value) return "";

	return value
		.normalize("NFKC")
		.toLowerCase()
		.replace(PLUS_CODE_PATTERN, " ")
		.replace(/\s+/g, " ")
		.trim()
		.replace(ADMIN_PREFIX_PATTERN, " ")
		.replace(KHMER_ADMIN_PREFIX_PATTERN, " ")
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
};

const compactAddressText = (value?: string | null): string => {
	return normalizeAddressText(value).replace(/\s+/g, "");
};

const buildUniqueTerms = (...values: Array<string | null | undefined>): string[] => {
	const seen = new Set<string>();
	const terms: string[] = [];

	for (const value of values) {
		if (!value) continue;

		for (const segment of [value, ...splitAddressSegments(value)]) {
			const trimmed = segment.trim();
			const normalized = normalizeAddressText(trimmed);

			if (!trimmed || !normalized || COUNTRY_TERMS.has(normalized) || seen.has(normalized)) {
				continue;
			}

			seen.add(normalized);
			terms.push(trimmed);
		}
	}

	return terms;
};

const scoreRecordAgainstTerm = (record: AddressLookupEntity, term: string): number => {
	const normalizedTerm = normalizeAddressText(term);
	const compactTerm = compactAddressText(term);
	if (!normalizedTerm) return -1;

	const candidateNames = [record.nameEn, record.nameKh]
		.map((name) => normalizeAddressText(name))
		.filter(Boolean);

	let bestScore = -1;

	for (const candidateName of candidateNames) {
		const compactCandidateName = candidateName.replace(/\s+/g, "");

		if (candidateName === normalizedTerm) {
			bestScore = Math.max(bestScore, 100);
			continue;
		}

		if (compactTerm && compactCandidateName === compactTerm) {
			bestScore = Math.max(bestScore, 96);
			continue;
		}

		if (candidateName.includes(normalizedTerm) || normalizedTerm.includes(candidateName)) {
			bestScore = Math.max(bestScore, 85);
			continue;
		}

		if (
			compactTerm &&
			(compactCandidateName.includes(compactTerm) ||
				compactTerm.includes(compactCandidateName))
		) {
			bestScore = Math.max(bestScore, 82);
			continue;
		}

		const candidateTokens = new Set(candidateName.split(" ").filter(Boolean));
		const termTokens = normalizedTerm.split(" ").filter(Boolean);
		const sharedTokens = termTokens.filter((token) => candidateTokens.has(token)).length;

		if (sharedTokens > 0) {
			bestScore = Math.max(bestScore, 60 + sharedTokens * 5);
		}
	}

	return bestScore;
};

const findBestLookupMatch = <T extends AddressLookupEntity>(items: T[], terms: string[]): T | null => {
	let bestMatch: T | null = null;
	let bestScore = -1;

	for (const term of terms) {
		for (const item of items) {
			const score = scoreRecordAgainstTerm(item, term);
			if (score > bestScore) {
				bestScore = score;
				bestMatch = item;
			}
		}
	}

	return bestScore >= 70 ? bestMatch : null;
};

export class PropertyAddressService {
	private repo: PropertyAddressRepository;

	constructor(repo = new PropertyAddressRepository()) {
		this.repo = repo;
	}

	getAllProvinces() {
		return cacheService.getOrSetJson(
			cacheKeys.address.provinces,
			config.redis.addressTtlSeconds,
			() => this.repo.getAllProvinces()
		);
	}

	getAllDistrictsByProvinceCode(provinceCode: string) {
		return cacheService.getOrSetJson(
			cacheKeys.address.districtsByProvince(provinceCode),
			config.redis.addressTtlSeconds,
			() => this.repo.getAllDistrictsByProvinceCode(provinceCode)
		);
	}

	getAllCommunesByDistrictCode(districtCode: string) {
		return cacheService.getOrSetJson(
			cacheKeys.address.communesByDistrict(districtCode),
			config.redis.addressTtlSeconds,
			() => this.repo.getAllCommunesByDistrictCode(districtCode)
		);
	}

	getAllVillagesByCommuneCode(communeCode: string) {
		return cacheService.getOrSetJson(
			cacheKeys.address.villagesByCommune(communeCode),
			config.redis.addressTtlSeconds,
			() => this.repo.getAllVillagesByCommuneCode(communeCode)
		);
	}

	private async matchHierarchyFromText(
		formattedAddress?: string | null,
		reverseGeocoded?: ReverseGeocodedAddress | null
	): Promise<ResolvedAddressHierarchy> {
		const levelTerms = extractAddressLevelTerms(formattedAddress);

		const provinceTerms = buildUniqueTerms(
			levelTerms.province,
			reverseGeocoded?.province,
			formattedAddress
		);
		const provinceItems = await this.repo.getProvinceLookupItems();
		let province = findBestLookupMatch(provinceItems, provinceTerms);

		const districtTerms = buildUniqueTerms(
			levelTerms.district,
			reverseGeocoded?.district,
			reverseGeocoded?.locality,
			formattedAddress
		);
		const districtItems = await this.repo.getDistrictLookupItems(province?.code);
		let district = findBestLookupMatch(districtItems, districtTerms);

		const communeTerms = buildUniqueTerms(
			levelTerms.commune,
			reverseGeocoded?.commune,
			reverseGeocoded?.sublocality,
			reverseGeocoded?.locality,
			formattedAddress
		);
		const communeItems = await this.repo.getCommuneLookupItems(district?.code);
		const commune = findBestLookupMatch(communeItems, communeTerms);

		if (!district && commune?.districtId) {
			const allDistricts = await this.repo.getDistrictLookupItems();
			const parentDistrict =
				allDistricts.find((item) => item.code === commune?.districtId) ?? null;
			if (parentDistrict) {
				district = parentDistrict;
			}
		}

		if (!province && district?.provinceId) {
			const parentProvince =
				provinceItems.find((item) => item.code === district?.provinceId) ?? null;
			if (parentProvince) {
				province = parentProvince;
			}
		}

		const villageTerms = buildUniqueTerms(
			levelTerms.village,
			reverseGeocoded?.village,
			reverseGeocoded?.sublocality,
			formattedAddress
		);
		const villageItems = commune?.code
			? await this.repo.getVillageLookupItems(commune.code)
			: [];
		const village = findBestLookupMatch(villageItems, villageTerms);

		return {
			province: province ?? null,
			district: district ?? null,
			commune: commune ?? null,
			village: village ?? null,
		};
	}

	private async alignHierarchyWithinParents(
		hierarchy: ResolvedAddressHierarchy,
		formattedAddress?: string | null,
		reverseGeocoded?: ReverseGeocodedAddress | null
	): Promise<ResolvedAddressHierarchy> {
		const levelTerms = extractAddressLevelTerms(formattedAddress);

		let province = hierarchy.province ?? null;
		let district = hierarchy.district ?? null;
		let commune = hierarchy.commune ?? null;
		let village = hierarchy.village ?? null;

		if (district && commune && commune.districtId !== district.code) {
			const communeTerms = buildUniqueTerms(
				levelTerms.commune,
				reverseGeocoded?.commune,
				reverseGeocoded?.sublocality,
				reverseGeocoded?.locality,
				formattedAddress
			);
			const communeItems = await this.repo.getCommuneLookupItems(district.code);
			commune = findBestLookupMatch(communeItems, communeTerms);
		}

		if (!commune && district) {
			const communeTerms = buildUniqueTerms(
				levelTerms.commune,
				reverseGeocoded?.commune,
				reverseGeocoded?.sublocality,
				reverseGeocoded?.locality,
				formattedAddress
			);
			const communeItems = await this.repo.getCommuneLookupItems(district.code);
			commune = findBestLookupMatch(communeItems, communeTerms);
		}

		if (!commune && village) {
			const allCommunes = district
				? await this.repo.getCommuneLookupItems(district.code)
				: await this.repo.getCommuneLookupItems();
			const parentCommune =
				allCommunes.find((item) => item.code === village?.communeId) ?? null;
			if (parentCommune) {
				commune = parentCommune;
			}
		}

		if (commune && district && !province) {
			const provinceItems = await this.repo.getProvinceLookupItems();
			province =
				provinceItems.find((item) => item.code === district?.provinceId) ?? null;
		}

		if (village && commune && village.communeId !== commune.code) {
			const villageTerms = buildUniqueTerms(
				levelTerms.village,
				reverseGeocoded?.village,
				reverseGeocoded?.sublocality,
				formattedAddress
			);
			const villageItems = await this.repo.getVillageLookupItems(commune.code);
			village = findBestLookupMatch(villageItems, villageTerms);
		}

		if (!village && commune) {
			const villageTerms = buildUniqueTerms(
				levelTerms.village,
				reverseGeocoded?.village,
				reverseGeocoded?.sublocality,
				formattedAddress
			);
			const villageItems = await this.repo.getVillageLookupItems(commune.code);
			village = findBestLookupMatch(villageItems, villageTerms);
		}

		if (village && !commune) {
			village = null;
		}

		return {
			province,
			district,
			commune,
			village,
		};
	}

	async resolveAddress(input: ResolvePropertyAddressInput) {
		const latitude =
			input.latitude !== undefined && input.latitude !== null
				? Number(input.latitude)
				: null;
		const longitude =
			input.longitude !== undefined && input.longitude !== null
				? Number(input.longitude)
				: null;
		const formattedAddress = input.formattedAddress?.trim() ?? "";

		const hasCoordinates = latitude !== null || longitude !== null;
		if (hasCoordinates && (latitude === null || longitude === null)) {
			throw new BadRequestError("latitude and longitude must be provided together");
		}

		if (
			latitude !== null &&
			(!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
		) {
			throw new BadRequestError("latitude must be between -90 and 90");
		}

		if (
			longitude !== null &&
			(!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
		) {
			throw new BadRequestError("longitude must be between -180 and 180");
		}

		if (latitude === null && longitude === null && !formattedAddress) {
			throw new BadRequestError("formattedAddress or latitude/longitude is required");
		}

		let resolvedLatitude = latitude;
		let resolvedLongitude = longitude;
		let reverseGeocoded: ReverseGeocodedAddress | null = null;
		let geocodedAddress:
			| {
					latitude: number;
					longitude: number;
					formattedAddress: string;
					placeId: string;
			  }
			| null = null;

		if (resolvedLatitude !== null && resolvedLongitude !== null) {
			try {
				reverseGeocoded = (await googleMapService.getAddressFromCoordinates(
					resolvedLatitude,
					resolvedLongitude
				)) as ReverseGeocodedAddress | null;
			} catch (error) {
				reverseGeocoded = null;
			}
		} else if (formattedAddress) {
			try {
				geocodedAddress = await googleMapService.geocodeAddress(formattedAddress);
				resolvedLatitude = geocodedAddress.latitude;
				resolvedLongitude = geocodedAddress.longitude;
			} catch (error) {
				geocodedAddress = null;
			}

			if (resolvedLatitude !== null && resolvedLongitude !== null) {
				try {
					reverseGeocoded = (await googleMapService.getAddressFromCoordinates(
						resolvedLatitude,
						resolvedLongitude
					)) as ReverseGeocodedAddress | null;
				} catch (error) {
					reverseGeocoded = null;
				}
			}
		}

		let hierarchy: ResolvedAddressHierarchy = {
			province: null,
			district: null,
			commune: null,
			village: null,
		};

		if (resolvedLatitude !== null && resolvedLongitude !== null) {
			hierarchy = await this.repo.resolveHierarchyByCoordinates(
				resolvedLatitude,
				resolvedLongitude
			);
		}

			const fallbackHierarchy = await this.matchHierarchyFromText(
				formattedAddress ||
					reverseGeocoded?.formattedAddress ||
					geocodedAddress?.formattedAddress,
				reverseGeocoded
			);
		const shouldPreferTextHierarchy = Boolean(formattedAddress);

		if (shouldPreferTextHierarchy) {
			hierarchy = {
				province: fallbackHierarchy.province ?? hierarchy.province,
				district: fallbackHierarchy.district ?? hierarchy.district,
				commune: fallbackHierarchy.commune ?? hierarchy.commune,
				village: fallbackHierarchy.village ?? hierarchy.village,
			};
		} else if (!hierarchy.province || !hierarchy.district || !hierarchy.commune) {
			hierarchy = {
				province: hierarchy.province ?? fallbackHierarchy.province,
				district: hierarchy.district ?? fallbackHierarchy.district,
				commune: hierarchy.commune ?? fallbackHierarchy.commune,
				village: hierarchy.village ?? fallbackHierarchy.village,
			};
		}

		hierarchy = await this.alignHierarchyWithinParents(
			hierarchy,
			formattedAddress ||
				reverseGeocoded?.formattedAddress ||
				geocodedAddress?.formattedAddress ||
				null,
			reverseGeocoded
		);

		const displayFormattedAddress =
			formattedAddress ||
			geocodedAddress?.formattedAddress ||
			reverseGeocoded?.formattedAddress ||
			null;
		const resolvedFormattedAddress =
			reverseGeocoded?.formattedAddress ||
			geocodedAddress?.formattedAddress ||
			null;

		return {
			latitude: resolvedLatitude,
			longitude: resolvedLongitude,
			formattedAddress: displayFormattedAddress,
			resolvedFormattedAddress,
			placeId: reverseGeocoded?.placeId ?? geocodedAddress?.placeId ?? null,
			street: reverseGeocoded?.route ?? null,
			houseNumber: reverseGeocoded?.streetNumber ?? null,
			googleMapLink:
				resolvedLatitude !== null && resolvedLongitude !== null
					? googleMapService.getGoogleMapLink(resolvedLatitude, resolvedLongitude)
					: null,
			provinceId: hierarchy.province?.code ?? null,
			districtId: hierarchy.district?.code ?? null,
			communeId: hierarchy.commune?.code ?? null,
			villageId: hierarchy.village?.code ?? null,
			province: hierarchy.province,
			district: hierarchy.district,
			commune: hierarchy.commune,
			village: hierarchy.village,
		};
	}
}
