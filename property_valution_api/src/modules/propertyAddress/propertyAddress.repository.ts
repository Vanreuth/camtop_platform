import fs from "fs";
import path from "path";
import { NotFoundError } from "../../common/errors/notFound.error";
import { prisma } from "../../db/prisma";

type ProvinceRow = {
	code: string;
	nameEn: string;
	nameKh: string;
	boundary: unknown;
};

type DistrictRow = {
	code: string;
	nameEn: string;
	nameKh: string;
	boundary: unknown;
};

type CommuneRow = {
	code: string;
	nameEn: string;
	nameKh: string;
	boundary: unknown;
};

type CommuneBoundaryFallbackRow = {
	districtCode: string;
	nameEn: string;
	nameKh: string;
	boundary: unknown;
};

let communeBoundaryFallbackCache: CommuneBoundaryFallbackRow[] | null = null;

const normalizeBoundaryLookupText = (value: string | null | undefined): string => {
	return (value ?? "")
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
};

const loadCommuneBoundaryFallbacks = (): CommuneBoundaryFallbackRow[] => {
	if (communeBoundaryFallbackCache) {
		return communeBoundaryFallbackCache;
	}

	try {
		const geoJsonPath = path.resolve(
			process.cwd(),
			"prisma",
			"data",
			"CambodiaCommuneBoundaries.geojson"
		);

		if (!fs.existsSync(geoJsonPath)) {
			communeBoundaryFallbackCache = [];
			return communeBoundaryFallbackCache;
		}

		const raw = fs.readFileSync(geoJsonPath, "utf-8");
		const parsed = JSON.parse(raw) as { features?: Array<{ properties?: any; geometry?: unknown }> };
		const features = Array.isArray(parsed.features) ? parsed.features : [];

		const fallbackRows: CommuneBoundaryFallbackRow[] = [];

		for (const feature of features) {
			const rawDistrictCode = String(feature.properties?.ADM2_PCODE ?? "").trim();
			const districtCode = rawDistrictCode.replace(/^KH/i, "");
			const nameEn = String(feature.properties?.ADM3_EN ?? "").trim();
			const nameKh = String(feature.properties?.ADM3_KM ?? feature.properties?.ADM3_KH ?? "").trim();
			const boundary = feature.geometry;

			if (!districtCode || boundary == null || (!nameEn && !nameKh)) {
				continue;
			}

			fallbackRows.push({
				districtCode,
				nameEn,
				nameKh,
				boundary,
			});
		}

		communeBoundaryFallbackCache = fallbackRows;
	} catch (error) {
		communeBoundaryFallbackCache = [];
	}

	return communeBoundaryFallbackCache;
};

const getFallbackCommuneBoundary = (
	districtCode: string,
	commune: Pick<CommuneRow, "nameEn" | "nameKh">
): unknown => {
	const district = districtCode.trim();
	if (!district) return null;

	const targetNameEn = normalizeBoundaryLookupText(commune.nameEn);
	const targetNameKh = normalizeBoundaryLookupText(commune.nameKh);
	if (!targetNameEn && !targetNameKh) return null;

	const match = loadCommuneBoundaryFallbacks().find((item) => {
		if (item.districtCode !== district) return false;

		const fallbackNameEn = normalizeBoundaryLookupText(item.nameEn);
		const fallbackNameKh = normalizeBoundaryLookupText(item.nameKh);

		return (
			(targetNameEn && targetNameEn === fallbackNameEn) ||
			(targetNameKh && targetNameKh === fallbackNameKh)
		);
	});

	return match?.boundary ?? null;
};

type VillageRow = {
	code: string;
	nameEn: string;
	nameKh: string;
};

export type ProvinceLookupRow = {
	code: string;
	nameEn: string;
	nameKh: string;
};

export type DistrictLookupRow = {
	code: string;
	provinceId: string;
	nameEn: string;
	nameKh: string;
};

export type CommuneLookupRow = {
	code: string;
	districtId: string;
	nameEn: string;
	nameKh: string;
};

export type VillageLookupRow = {
	code: string;
	communeId: string;
	nameEn: string;
	nameKh: string;
};

export type ResolvedAddressHierarchy = {
	province: ProvinceLookupRow | null;
	district: DistrictLookupRow | null;
	commune: CommuneLookupRow | null;
	village: VillageLookupRow | null;
};

export class PropertyAddressRepository {
	private isGeometryQueryIssue(error: unknown): boolean {
		const message =
			typeof error === "object" && error !== null && "message" in error
				? String((error as { message?: unknown }).message ?? "")
				: "";

		const normalized = message.toLowerCase();
		return (
			normalized.includes("st_asgeojson") ||
			normalized.includes("geometry") ||
			normalized.includes("postgis") ||
			(normalized.includes("column") && normalized.includes("geom"))
		);
	}

	async getAllProvinces() {
		try {
			return await prisma.$queryRaw<ProvinceRow[]>`
				SELECT province_id as "code", province_name_en as "nameEn", province_name_kh as "nameKh",
						 ST_AsGeoJSON(geom)::json as "boundary"
				FROM provinces
				ORDER BY province_id ASC
			`;
		} catch (error) {
			if (!this.isGeometryQueryIssue(error)) throw error;

			return prisma.$queryRaw<ProvinceRow[]>`
				SELECT province_id as "code", province_name_en as "nameEn", province_name_kh as "nameKh",
						 NULL::json as "boundary"
				FROM provinces
				ORDER BY province_id ASC
			`;
		}
	}

	async getAllDistrictsByProvinceCode(provinceCode: string) {
		const code = provinceCode.trim();
		if (!code) return [];

		try {
			return await prisma.$queryRaw<DistrictRow[]>`
				SELECT district_id as "code", district_name_en as "nameEn", district_name_kh as "nameKh",
						 ST_AsGeoJSON(geom)::json as "boundary"
				FROM districts
				WHERE province_id = ${code}
				ORDER BY district_id ASC
			`;
		} catch (error) {
			if (!this.isGeometryQueryIssue(error)) throw error;

			return prisma.$queryRaw<DistrictRow[]>`
				SELECT district_id as "code", district_name_en as "nameEn", district_name_kh as "nameKh",
						 NULL::json as "boundary"
				FROM districts
				WHERE province_id = ${code}
				ORDER BY district_id ASC
			`;
		}
	}

	async getAllCommunesByDistrictCode(districtCode: string) {
		const code = districtCode.trim();
		if (!code) return [];

		try {
			const rows = await prisma.$queryRaw<CommuneRow[]>`
				SELECT commune_id as "code", commune_name_en as "nameEn", commune_name_kh as "nameKh",
						 ST_AsGeoJSON(geom)::json as "boundary"
				FROM communes
				WHERE district_id = ${code}
				ORDER BY commune_id ASC
			`;

			return rows.map((row) => ({
				...row,
				boundary: row.boundary ?? getFallbackCommuneBoundary(code, row),
			}));
		} catch (error) {
			if (!this.isGeometryQueryIssue(error)) throw error;

			const rows = await prisma.$queryRaw<CommuneRow[]>`
				SELECT commune_id as "code", commune_name_en as "nameEn", commune_name_kh as "nameKh",
						 NULL::json as "boundary"
				FROM communes
				WHERE district_id = ${code}
				ORDER BY commune_id ASC
			`;

			return rows.map((row) => ({
				...row,
				boundary: getFallbackCommuneBoundary(code, row),
			}));
		}
	}

	async getAllVillagesByCommuneCode(communeCode: string) {
		const commune = await prisma.commune.findUnique({ where: { code: communeCode } });
		if (!commune) throw new NotFoundError(`Commune with code ${communeCode} not found`);

		return prisma.village.findMany({
			where: { communeId: commune.code },
			select: { code: true, nameEn: true, nameKh: true },
			orderBy: { code: "asc" },
		});
	}

	async getProvinceLookupItems() {
		return prisma.province.findMany({
			select: { code: true, nameEn: true, nameKh: true },
			orderBy: { code: "asc" },
		});
	}

	async getDistrictLookupItems(provinceCode?: string | null) {
		return prisma.district.findMany({
			where: provinceCode ? { provinceId: provinceCode } : undefined,
			select: { code: true, provinceId: true, nameEn: true, nameKh: true },
			orderBy: { code: "asc" },
		});
	}

	async getCommuneLookupItems(districtCode?: string | null) {
		return prisma.commune.findMany({
			where: districtCode ? { districtId: districtCode } : undefined,
			select: { code: true, districtId: true, nameEn: true, nameKh: true },
			orderBy: { code: "asc" },
		});
	}

	async getVillageLookupItems(communeCode?: string | null) {
		return prisma.village.findMany({
			where: communeCode ? { communeId: communeCode } : undefined,
			select: { code: true, communeId: true, nameEn: true, nameKh: true },
			orderBy: { code: "asc" },
		});
	}

	async resolveHierarchyByCoordinates(
		latitude: number,
		longitude: number
	): Promise<ResolvedAddressHierarchy> {
		try {
			const [province] = await prisma.$queryRaw<ProvinceLookupRow[]>`
				SELECT
					province_id as "code",
					province_name_en as "nameEn",
					province_name_kh as "nameKh"
				FROM provinces
				WHERE geom IS NOT NULL
					AND ST_Intersects(
						geom,
						ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
					)
				ORDER BY province_id ASC
				LIMIT 1
			`;

			const [district] = province
				? await prisma.$queryRaw<DistrictLookupRow[]>`
					SELECT
						district_id as "code",
						province_id as "provinceId",
						district_name_en as "nameEn",
						district_name_kh as "nameKh"
					FROM districts
					WHERE province_id = ${province.code}
						AND geom IS NOT NULL
						AND ST_Intersects(
							geom,
							ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
						)
					ORDER BY district_id ASC
					LIMIT 1
				`
				: [];

			const [commune] = district
				? await prisma.$queryRaw<CommuneLookupRow[]>`
					SELECT
						commune_id as "code",
						district_id as "districtId",
						commune_name_en as "nameEn",
						commune_name_kh as "nameKh"
					FROM communes
					WHERE district_id = ${district.code}
						AND geom IS NOT NULL
						AND ST_Intersects(
							geom,
							ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
						)
					ORDER BY commune_id ASC
					LIMIT 1
				`
				: [];

			const [village] = commune
				? await prisma.$queryRaw<VillageLookupRow[]>`
					SELECT
						village_id as "code",
						commune_id as "communeId",
						village_name_en as "nameEn",
						village_name_kh as "nameKh"
					FROM villages
					WHERE commune_id = ${commune.code}
						AND geom IS NOT NULL
						AND ST_Intersects(
							geom,
							ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
						)
					ORDER BY village_id ASC
					LIMIT 1
				`
				: [];

			return {
				province: province ?? null,
				district: district ?? null,
				commune: commune ?? null,
				village: village ?? null,
			};
		} catch (error) {
			if (!this.isGeometryQueryIssue(error)) throw error;

			return {
				province: null,
				district: null,
				commune: null,
				village: null,
			};
		}
	}
}

