import expressAsyncHandler from "express-async-handler";
import type { Request, Response } from "express";
import { propertyTypeService } from "./propertyType.service";
import { NotFoundError } from "../../common/errors/notFound.error";
import type { CreatePropertyTypeDto } from "./propertyType.dto";

const getAllPropertyTypes = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const data = await propertyTypeService.getAllPropertyTypes();

    res.json({
      status: "success",
      message: "Get Propertytype sucessfully",
      data: {
        propertyType: data,
      },
    });
  }
);

const getPropertyTypeById = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = await propertyTypeService.getPropertyTypeById(Number(id));

    if (!data) {
      throw new NotFoundError("PropertyType not found!");
    }
    res.json({
      status: "success",
      message: "Get PropertyType by Id successfully",
      data: {
        propertyType: data,
      },
    });
  }
);

const createPropertyType = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const propertyTypeData: CreatePropertyTypeDto = {
      ...req.body,
    };
    const data = await propertyTypeService.createPropertyType(propertyTypeData);
    res.json({
      status: "success",
      message: "Create ProperType sucessfullty",
      data: {
        propertype: data,
      },
    });
  }
);

const updatePropertyType = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const propertyType = await propertyTypeService.updatePropertyType(
      Number(id),
      {
        ...req.body,
      }
    );

    res.json({
      status: "success",
      message: "Update ProperType sucessfullty",
      data: propertyType,
    });
  }
);

const deletePropertyType = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const data = await propertyTypeService.deletePropertyType(Number(id));

    if (!data) {
      throw new NotFoundError("PropertyId not found");
    }

    res.json({
      status: "sucess",
      message: "Delete PropertyId sucessfully",
    });
  }
);

export {
  getAllPropertyTypes,
  getPropertyTypeById,
  createPropertyType,
  updatePropertyType,
  deletePropertyType,
};
