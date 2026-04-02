import type { Multer } from "multer";

export const propertyUploadFields: Parameters<Multer["fields"]>[0] = [
	{ name: "frontSide", maxCount: 1 },
	{ name: "inside", maxCount: 1 },
	{ name: "leftSide", maxCount: 1 },
	{ name: "rightSide", maxCount: 1 },
	{ name: "opposite", maxCount: 1 },
	{ name: "gallery", maxCount: 10 },
	{ name: "coverPhoto", maxCount: 1 },
	{ name: "backSidePhoto", maxCount: 1 },
	{ name: "buildingImage", maxCount: 1 },
	{ name: "buildingImages", maxCount: 20 },
];
