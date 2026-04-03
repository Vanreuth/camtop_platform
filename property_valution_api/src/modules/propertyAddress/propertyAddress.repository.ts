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
	code: string;
	districtCode: string;
	nameEn: string;
	nameKh: string;
	boundary: GeoBoundary;
	boundingBox: BoundingBox | null;
};

type DistrictBoundaryFallbackRow = {
	code: string;
	provinceCode: string;
	nameEn: string;
	nameKh: string;
	boundary: GeoBoundary;
	boundingBox: BoundingBox | null;
};

type BoundingBox = {
	minLongitude: number;
	maxLongitude: number;
	minLatitude: number;
	maxLatitude: number;
};

type Position = [number, number];
type GeoBoundary =
	| {
			type: "Polygon";
			coordinates: Position[][];
	  }
	| {
			type: "MultiPolygon";
			coordinates: Position[][][];
	  };

let districtBoundaryFallbackCache: DistrictBoundaryFallbackRow[] | null = null;
let communeBoundaryFallbackCache: CommuneBoundaryFallbackRow[] | null = null;

const normalizeBoundaryLookupText = (value: string | null | undefined): string => {
	return (value ?? "")
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
	.trim();
};

const resolveBoundaryDataFilePath = (fileName: string): string | null => {
	const candidates = [
		path.resolve(process.cwd(), "prisma", "data", fileName),
		path.resolve(process.cwd(), "property_valution_api", "prisma", "data", fileName),
		path.resolve(__dirname, "../../../prisma/data", fileName),
	];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
};

const isPosition = (value: unknown): value is Position => {
	return (
		Array.isArray(value) &&
		value.length >= 2 &&
		typeof value[0] === "number" &&
		Number.isFinite(value[0]) &&
		typeof value[1] === "number" &&
		Number.isFinite(value[1])
	);
};

const parseGeoBoundary = (value: unknown): GeoBoundary | null => {
	if (!value || typeof value !== "object") return null;

	const geometry = value as { type?: unknown; coordinates?: unknown };
	if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
		const coordinates = geometry.coordinates.filter(Array.isArray).map((ring) =>
			(Array.isArray(ring) ? ring.filter(isPosition) : [])
		);
		return coordinates.length ? { type: "Polygon", coordinates } : null;
	}

	if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
		const coordinates = geometry.coordinates
			.filter(Array.isArray)
			.map((polygon) =>
				(Array.isArray(polygon) ? polygon.filter(Array.isArray).map((ring) =>
					(Array.isArray(ring) ? ring.filter(isPosition) : [])
				) : [])
			)
			.filter((polygon) => polygon.length > 0);
		return coordinates.length ? { type: "MultiPolygon", coordinates } : null;
	}

	return null;
};

const flattenBoundaryPositions = (boundary: GeoBoundary): Position[] => {
	if (boundary.type === "Polygon") {
		return boundary.coordinates.flat();
	}

	return boundary.coordinates.flat(2);
};

const getBoundaryBoundingBox = (boundary: GeoBoundary | null): BoundingBox | null => {
	if (!boundary) return null;

	const positions = flattenBoundaryPositions(boundary);
	if (!positions.length) return null;

	let minLongitude = Number.POSITIVE_INFINITY;
	let maxLongitude = Number.NEGATIVE_INFINITY;
	let minLatitude = Number.POSITIVE_INFINITY;
	let maxLatitude = Number.NEGATIVE_INFINITY;

	for (const [longitude, latitude] of positions) {
		minLongitude = Math.min(minLongitude, longitude);
		maxLongitude = Math.max(maxLongitude, longitude);
		minLatitude = Math.min(minLatitude, latitude);
		maxLatitude = Math.max(maxLatitude, latitude);
	}

	return { minLongitude, maxLongitude, minLatitude, maxLatitude };
};

const isPointInBoundingBox = (
	longitude: number,
	latitude: number,
	boundingBox: BoundingBox | null
): boolean => {
	if (!boundingBox) return false;

	return (
		longitude >= boundingBox.minLongitude &&
		longitude <= boundingBox.maxLongitude &&
		latitude >= boundingBox.minLatitude &&
		latitude <= boundingBox.maxLatitude
	);
};

const isPointOnSegment = (
	longitude: number,
	latitude: number,
	start: Position,
	end: Position
): boolean => {
	const [x1, y1] = start;
	const [x2, y2] = end;
	const cross = (longitude - x1) * (y2 - y1) - (latitude - y1) * (x2 - x1);
	if (Math.abs(cross) > 1e-12) return false;

	const dot = (longitude - x1) * (x2 - x1) + (latitude - y1) * (y2 - y1);
	if (dot < 0) return false;

	const squaredLength = (x2 - x1) ** 2 + (y2 - y1) ** 2;
	return dot <= squaredLength;
};

const isPointInRing = (longitude: number, latitude: number, ring: Position[]): boolean => {
	let inside = false;

	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const start = ring[i];
		const end = ring[j];
		if (!start || !end) continue;

		if (isPointOnSegment(longitude, latitude, start, end)) {
			return true;
		}

		const [xi, yi] = start;
		const [xj, yj] = end;
		const intersects =
			yi > latitude !== yj > latitude &&
			longitude < ((xj - xi) * (latitude - yi)) / ((yj - yi) || Number.EPSILON) + xi;
		if (intersects) {
			inside = !inside;
		}
	}

	return inside;
};

const isPointInPolygon = (
	longitude: number,
	latitude: number,
	polygon: Position[][]
): boolean => {
	const [outerRing, ...holes] = polygon;
	if (!outerRing?.length || !isPointInRing(longitude, latitude, outerRing)) {
		return false;
	}

	return !holes.some((hole) => hole.length && isPointInRing(longitude, latitude, hole));
};

const isPointInBoundary = (
	longitude: number,
	latitude: number,
	boundary: GeoBoundary | null,
	boundingBox: BoundingBox | null
): boolean => {
	if (!boundary || !isPointInBoundingBox(longitude, latitude, boundingBox)) {
		return false;
	}

	if (boundary.type === "Polygon") {
		return isPointInPolygon(longitude, latitude, boundary.coordinates);
	}

	return boundary.coordinates.some((polygon) => isPointInPolygon(longitude, latitude, polygon));
};

const loadDistrictBoundaryFallbacks = (): DistrictBoundaryFallbackRow[] => {
	if (districtBoundaryFallbackCache) {
		return districtBoundaryFallbackCache;
	}

	try {
		const geoJsonPath = resolveBoundaryDataFilePath("CambodiaDistrictBoundaries.geojson");

		if (!geoJsonPath) {
			districtBoundaryFallbackCache = [];
			return districtBoundaryFallbackCache;
		}

		const raw = fs.readFileSync(geoJsonPath, "utf-8");
		const parsed = JSON.parse(raw) as { features?: Array<{ properties?: any; geometry?: unknown }> };
		const features = Array.isArray(parsed.features) ? parsed.features : [];
		const fallbackRows: DistrictBoundaryFallbackRow[] = [];

		for (const feature of features) {
			const code = String(feature.properties?.ADM2_PCODE ?? "").trim().replace(/^KH/i, "");
			const provinceCode = String(feature.properties?.ADM1_PCODE ?? "")
				.trim()
				.replace(/^KH/i, "");
			const nameEn = String(feature.properties?.ADM2_EN ?? "").trim();
			const nameKh = String(feature.properties?.ADM2_KM ?? feature.properties?.ADM2_KH ?? "").trim();
			const boundary = parseGeoBoundary(feature.geometry);

			if (!code || !provinceCode || boundary == null || (!nameEn && !nameKh)) {
				continue;
			}

			fallbackRows.push({
				code,
				provinceCode,
				nameEn,
				nameKh,
				boundary,
				boundingBox: getBoundaryBoundingBox(boundary),
			});
		}

		districtBoundaryFallbackCache = fallbackRows;
	} catch (error) {
		districtBoundaryFallbackCache = [];
	}

	return districtBoundaryFallbackCache ?? [];
};

const loadCommuneBoundaryFallbacks = (): CommuneBoundaryFallbackRow[] => {
	if (communeBoundaryFallbackCache) {
		return communeBoundaryFallbackCache;
	}

	try {
		const geoJsonPath = resolveBoundaryDataFilePath("CambodiaCommuneBoundaries.geojson");

		if (!geoJsonPath) {
			communeBoundaryFallbackCache = [];
			return communeBoundaryFallbackCache;
		}

		const raw = fs.readFileSync(geoJsonPath, "utf-8");
		const parsed = JSON.parse(raw) as { features?: Array<{ properties?: any; geometry?: unknown }> };
		const features = Array.isArray(parsed.features) ? parsed.features : [];

		const fallbackRows: CommuneBoundaryFallbackRow[] = [];

		for (const feature of features) {
			const rawCommuneCode = String(feature.properties?.ADM3_PCODE ?? "").trim();
			const rawDistrictCode = String(feature.properties?.ADM2_PCODE ?? "").trim();
			const code = rawCommuneCode.replace(/^KH/i, "");
			const districtCode = rawDistrictCode.replace(/^KH/i, "");
			const nameEn = String(feature.properties?.ADM3_EN ?? "").trim();
			const nameKh = String(feature.properties?.ADM3_KM ?? feature.properties?.ADM3_KH ?? "").trim();
			const boundary = parseGeoBoundary(feature.geometry);

			if (!code || !districtCode || boundary == null || (!nameEn && !nameKh)) {
				continue;
			}

			fallbackRows.push({
				code,
				districtCode,
				nameEn,
				nameKh,
				boundary,
				boundingBox: getBoundaryBoundingBox(boundary),
			});
		}

		communeBoundaryFallbackCache = fallbackRows;
	} catch (error) {
		communeBoundaryFallbackCache = [];
	}

	return communeBoundaryFallbackCache ?? [];
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

	private findDistrictFallbackByPoint(
		provinceCode: string,
		latitude: number,
		longitude: number
	): DistrictLookupRow | null {
		const match = loadDistrictBoundaryFallbacks().find(
			(item) =>
				item.provinceCode === provinceCode &&
				isPointInBoundary(longitude, latitude, item.boundary, item.boundingBox)
		);

		if (!match) {
			return null;
		}

		return {
			code: match.code,
			provinceId: match.provinceCode,
			nameEn: match.nameEn,
			nameKh: match.nameKh,
		};
	}

	private findCommuneFallbackByPoint(
		districtCode: string,
		latitude: number,
		longitude: number
	): CommuneLookupRow | null {
		const match = loadCommuneBoundaryFallbacks().find(
			(item) =>
				item.districtCode === districtCode &&
				isPointInBoundary(longitude, latitude, item.boundary, item.boundingBox)
		);

		if (!match) {
			return null;
		}

		return {
			code: match.code,
			districtId: match.districtCode,
			nameEn: match.nameEn,
			nameKh: match.nameKh,
		};
	}

	private async resolveDistrictByCoordinates(
		provinceCode: string,
		latitude: number,
		longitude: number
	): Promise<DistrictLookupRow | null> {
		const [district] = await prisma.$queryRaw<DistrictLookupRow[]>`
			SELECT
				district_id as "code",
				province_id as "provinceId",
				district_name_en as "nameEn",
				district_name_kh as "nameKh"
			FROM districts
			WHERE province_id = ${provinceCode}
				AND geom IS NOT NULL
				AND ST_Intersects(
					geom,
					ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
				)
			ORDER BY district_id ASC
			LIMIT 1
		`;

		if (district) {
			return district;
		}

		const fallbackDistrict = this.findDistrictFallbackByPoint(
			provinceCode,
			latitude,
			longitude
		);
		if (fallbackDistrict) {
			return fallbackDistrict;
		}

		const [nearestDistrict] = await prisma.$queryRaw<DistrictLookupRow[]>`
			SELECT
				district_id as "code",
				province_id as "provinceId",
				district_name_en as "nameEn",
				district_name_kh as "nameKh"
			FROM districts
			WHERE province_id = ${provinceCode}
				AND geom IS NOT NULL
			ORDER BY
				ST_Distance(
					geom::geography,
					ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
				) ASC,
				district_id ASC
			LIMIT 1
		`;

		return nearestDistrict ?? null;
	}

	private async resolveCommuneByCoordinates(
		districtCode: string,
		latitude: number,
		longitude: number
	): Promise<CommuneLookupRow | null> {
		const [commune] = await prisma.$queryRaw<CommuneLookupRow[]>`
			SELECT
				commune_id as "code",
				district_id as "districtId",
				commune_name_en as "nameEn",
				commune_name_kh as "nameKh"
			FROM communes
			WHERE district_id = ${districtCode}
				AND geom IS NOT NULL
				AND ST_Intersects(
					geom,
					ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
				)
			ORDER BY commune_id ASC
			LIMIT 1
		`;

		if (commune) {
			return commune;
		}

		const fallbackCommune = this.findCommuneFallbackByPoint(
			districtCode,
			latitude,
			longitude
		);
		if (fallbackCommune) {
			return fallbackCommune;
		}

		const [nearestCommune] = await prisma.$queryRaw<CommuneLookupRow[]>`
			SELECT
				commune_id as "code",
				district_id as "districtId",
				commune_name_en as "nameEn",
				commune_name_kh as "nameKh"
			FROM communes
			WHERE district_id = ${districtCode}
				AND geom IS NOT NULL
			ORDER BY
				ST_Distance(
					geom::geography,
					ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
				) ASC,
				commune_id ASC
			LIMIT 1
		`;

		return nearestCommune ?? null;
	}

	private async resolveVillageByCoordinates(
		communeCode: string,
		latitude: number,
		longitude: number
	): Promise<VillageLookupRow | null> {
		const [village] = await prisma.$queryRaw<VillageLookupRow[]>`
			SELECT
				village_id as "code",
				commune_id as "communeId",
				village_name_en as "nameEn",
				village_name_kh as "nameKh"
			FROM villages
			WHERE commune_id = ${communeCode}
				AND geom IS NOT NULL
				AND ST_Intersects(
					geom,
					ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
				)
			ORDER BY village_id ASC
			LIMIT 1
		`;

		if (village) {
			return village;
		}

		const [nearestVillage] = await prisma.$queryRaw<VillageLookupRow[]>`
			SELECT
				village_id as "code",
				commune_id as "communeId",
				village_name_en as "nameEn",
				village_name_kh as "nameKh"
			FROM villages
			WHERE commune_id = ${communeCode}
				AND geom IS NOT NULL
			ORDER BY
				ST_Distance(
					geom::geography,
					ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
				) ASC,
				village_id ASC
			LIMIT 1
		`;

		return nearestVillage ?? null;
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

			const district = province
				? await this.resolveDistrictByCoordinates(province.code, latitude, longitude)
				: null;

			const commune = district
				? await this.resolveCommuneByCoordinates(district.code, latitude, longitude)
				: null;

			const village = commune
				? await this.resolveVillageByCoordinates(commune.code, latitude, longitude)
				: null;

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

