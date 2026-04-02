import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
	communeCodeParamSchema,
	districtCodeParamSchema,
	provinceCodeParamSchema,
	resolvePropertyAddressBodySchema,
} from "./propertyAddress.dto";
import { PropertyAddressController } from "./propertyAddress.controller";

export const propertyAddressRoutes = Router();

// protect all propertyAddress routes
propertyAddressRoutes.use(authenticate);

// 1. Get All Provinces
propertyAddressRoutes.get("/provinces", PropertyAddressController.getAllProvinces);

// 2. Get Districts by province code
propertyAddressRoutes.get(
	"/provinces/:provinceCode/districts",
	validate(provinceCodeParamSchema, "params"),
	PropertyAddressController.getAllDistrictsByProvinceCode
);

// 3. Get Communes by district code
propertyAddressRoutes.get(
	"/districts/:districtCode/communes",
	validate(districtCodeParamSchema, "params"),
	PropertyAddressController.getAllCommunesByDistrictCode
);

// 4. Get Villages by commune code
propertyAddressRoutes.get(
	"/communes/:communeCode/villages",
	validate(communeCodeParamSchema, "params"),
	PropertyAddressController.getAllVillagesByCommuneCode
);

// 5. Resolve coordinates or detected address into address hierarchy
propertyAddressRoutes.post(
	"/resolve",
	validate(resolvePropertyAddressBodySchema, "body"),
	PropertyAddressController.resolveAddress
);

