import type { Request, Response } from "express";
import { PropertyAddressService } from "./propertyAddress.service";

const service = new PropertyAddressService();

export class PropertyAddressController {
	private static getSingleParamValue(value?: string | string[]): string {
		if (Array.isArray(value)) {
			return value[0] ?? "";
		}
		return value ?? "";
	}

	static async getAllProvinces(req: Request, res: Response) {
		const data = await service.getAllProvinces();
		res.status(200).json({
			status: "success",
			message: "Get all provinces successfully",
			data,
		});
	}

	static async getAllDistrictsByProvinceCode(req: Request, res: Response) {
		const provinceCode = PropertyAddressController.getSingleParamValue(
			req.params.provinceCode
		);
		const data = await service.getAllDistrictsByProvinceCode(provinceCode);
		res.status(200).json({
			status: "success",
			message: `Get all districts for province code ${provinceCode} successfully`,
			data,
		});
	}

	static async getAllCommunesByDistrictCode(req: Request, res: Response) {
		const districtCode = PropertyAddressController.getSingleParamValue(
			req.params.districtCode
		);
		const data = await service.getAllCommunesByDistrictCode(districtCode);
		res.status(200).json({
			status: "success",
			message: `Get all communes for district code ${districtCode} successfully`,
			data,
		});
	}

	static async getAllVillagesByCommuneCode(req: Request, res: Response) {
		const communeCode = PropertyAddressController.getSingleParamValue(
			req.params.communeCode
		);
		const data = await service.getAllVillagesByCommuneCode(communeCode);
		res.status(200).json({
			status: "success",
			message: `Get all villages for commune code ${communeCode} successfully`,
			data,
		});
	}

	static async resolveAddress(req: Request, res: Response) {
		const data = await service.resolveAddress(req.body);
		res.status(200).json({
			status: "success",
			message: "Resolve property address successfully",
			data,
		});
	}
}
