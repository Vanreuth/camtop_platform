import expressAsyncHandler from "express-async-handler";
import { Response } from "express";
import { AuthRequest } from "../../common/types/auth.type";
import { successResponse } from "../../common/utils/responseHelper";
import {
  CreateIndicativeComponentDTO,
  CreateIndicativeValuationDTO,
  UpdateIndicativeComponentDTO,
  UpdateIndicativeValuationDTO,
  ApproveIndicativeValuationDTO,
  RejectIndicativeValuationDTO,
  ReassignIndicativeValuationDTO,
  IndicativeValuationFiltersDTO,
  indicativeValuationFiltersSchema,
  approveIndicativeValuationSchema,
  rejectIndicativeValuationSchema,
  reassignIndicativeValuationSchema,
  createIndicativeValuationSchema,
  updateIndicativeValuationSchema,
  createIndicativeComponentSchema,
  updateIndicativeComponentSchema,
} from "./indicativeValuation.dto";
import { indicativeValuationService } from "./indicativeValuation.service";
import { BadRequestError } from "../../common/errors/badRequest.error";
import {
  exportIndicativeValuationToExcel,
  exportIndicativeValuationsToExcel,
} from "./indicativeValuation.excel.service";
import type { FileField } from "../property/property.dto";

/** GET /property-indicativeValuation */
export const getAllIndicativeValuations = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const filters = indicativeValuationFiltersSchema.parse(req.query) as IndicativeValuationFiltersDTO;
    const result = await indicativeValuationService.getAllIndicativeValuations(filters);

    successResponse(res, 200, result.data, result.message, {
      pagination: result.pagination,
    });
  }
);

/** POST /property-indicativeValuation */
export const createIndicativeValuation = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError("Unauthorized");
    }

    const dto = createIndicativeValuationSchema.parse(req.body) as CreateIndicativeValuationDTO;
    const files = (req.files as FileField | undefined) ?? undefined;
    const userHierarchyLevel = req.user.roles?.length
      ? Math.min(...req.user.roles.map((role: any) => role.hierarchyLevel))
      : 99;
    const data = await indicativeValuationService.createIndicativeValuation(
      dto,
      req.user.id,
      userHierarchyLevel,
      files
    );
    successResponse(res, 201, data, "Indicative valuation created");
  }
);

/** GET /property-indicativeValuation/:indicationId */
export const getIndicativeValuation = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const indicationId = Number(req.params.indicationId);
    const result = await indicativeValuationService.getIndicativeValuation(indicationId);
    successResponse(res, 200, result.data, result.message);
  }
);

/** GET /property-indicativeValuation/export/excel */
export const exportIndicativeValuationsExcel = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const filters = indicativeValuationFiltersSchema.parse(req.query) as IndicativeValuationFiltersDTO;
    const buffer = await exportIndicativeValuationsToExcel(filters);
    const payload = Buffer.from(buffer);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"indicative-valuations-${timestamp}.xlsx\"`
    );
    res.status(200).send(payload);
  }
);

/** GET /property-indicativeValuation/:indicationId/export/excel */
export const exportIndicativeValuationExcel = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const indicationId = Number(req.params.indicationId);

    if (Number.isNaN(indicationId)) {
      throw new BadRequestError("Invalid indication ID");
    }

    const buffer = await exportIndicativeValuationToExcel(indicationId);
    const payload = Buffer.from(buffer);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"indicative-valuation-${indicationId}-${timestamp}.xlsx\"`
    );
    res.status(200).send(payload);
  }
);

/** GET /property-indicativeValuation/:indicationId/export/pdf */
export const exportIndicativeValuationPdf = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const indicationId = Number(req.params.indicationId);

    if (Number.isNaN(indicationId)) {
      throw new BadRequestError("Invalid indication ID");
    }

    const refreshQuery =
      typeof req.query.refresh === "string" ? req.query.refresh.toLowerCase() : undefined;
    const refresh = refreshQuery === undefined ? false : refreshQuery !== "false";

    const result = await indicativeValuationService.getIndicativePdfDocument(indicationId, {
      refresh,
    });

    successResponse(res, 200, result.data, result.message);
  }
);

/** PATCH /property-indicativeValuation/:indicationId */
export const updateIndicativeValuation = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError("Unauthorized");
    }

    const indicationId = Number(req.params.indicationId);
    const dto = updateIndicativeValuationSchema.parse(req.body) as UpdateIndicativeValuationDTO;
    const userHierarchyLevel = req.user.roles?.length
      ? Math.min(...req.user.roles.map((role: any) => role.hierarchyLevel))
      : 99;

    const result = await indicativeValuationService.updateIndicativeValuation(
      indicationId,
      dto,
      req.user.id,
      userHierarchyLevel
    );

    successResponse(res, 200, result.data, result.message);
  }
);

/** POST /property-indicativeValuation/:indicationId/submit */
export const submitForReview = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError("Unauthorized");
    }

    const indicationId = Number(req.params.indicationId);
    const userHierarchyLevel = req.user.roles?.length
      ? Math.min(...req.user.roles.map((role: any) => role.hierarchyLevel))
      : 99;

    const result = await indicativeValuationService.submitForReview(
      indicationId,
      req.user.id,
      userHierarchyLevel
    );

    successResponse(res, 200, result.data, result.message);
  }
);

/** PATCH /property-indicativeValuation/:indicationId/approve */
export const approveValuation = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError("Unauthorized");
    }

    const indicationId = Number(req.params.indicationId);
    const dto = approveIndicativeValuationSchema.parse(req.body) as ApproveIndicativeValuationDTO;
    const result = await indicativeValuationService.approveValuation(
      indicationId,
      dto,
      req.user.id
    );

    successResponse(res, 200, result.data, result.message);
  }
);

/** PATCH /property-indicativeValuation/:indicationId/reject */
export const rejectValuation = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError("Unauthorized");
    }

    const indicationId = Number(req.params.indicationId);
    const dto = rejectIndicativeValuationSchema.parse(req.body) as RejectIndicativeValuationDTO;
    const result = await indicativeValuationService.rejectValuation(
      indicationId,
      dto,
      req.user.id
    );

    successResponse(res, 200, result.data, result.message);
  }
);

/** PATCH /property-indicativeValuation/:indicationId/reassign */
export const reassignIndicativeValuation = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError("Unauthorized");
    }

    const indicationId = Number(req.params.indicationId);
    const dto = reassignIndicativeValuationSchema.parse(req.body) as ReassignIndicativeValuationDTO;
    const userHierarchyLevel = req.user.roles?.length
      ? Math.min(...req.user.roles.map((role: any) => role.hierarchyLevel))
      : 99;

    const result = await indicativeValuationService.reassignIndicativeValuation(
      indicationId,
      dto.newValuerId,
      req.user.id,
      userHierarchyLevel
    );

    successResponse(res, 200, result.data, result.message);
  }
);

/** DELETE /property-indicativeValuation/:indicationId */
export const archiveIndicativeValuation = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      throw new BadRequestError("Unauthorized");
    }

    const indicationId = Number(req.params.indicationId);
    const userHierarchyLevel = req.user.roles?.length
      ? Math.min(...req.user.roles.map((role: any) => role.hierarchyLevel))
      : 99;

    const result = await indicativeValuationService.archiveIndicativeValuation(
      indicationId,
      req.user.id,
      userHierarchyLevel
    );

    successResponse(res, 200, result.data, result.message);
  }
);

/** GET /property-indicativeValuation/:indicationId/components/:id */
export const getComponentById = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const indicationId = Number(req.params.indicationId);
    const id = Number(req.params.id);
    const data = await indicativeValuationService.getComponentById(indicationId, id);
    successResponse(res, 200, data);
  }
);

/** POST /property-indicativeValuation/:indicationId/components */
export const createComponent = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const indicationId = Number(req.params.indicationId);
    const dto = createIndicativeComponentSchema.parse(req.body) as CreateIndicativeComponentDTO;
    const data = await indicativeValuationService.createComponent(indicationId, dto);
    successResponse(res, 201, data, "Component created");
  }
);

/** PATCH /property-indicativeValuation/:indicationId/components/:id */
export const updateComponent = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const indicationId = Number(req.params.indicationId);
    const id = Number(req.params.id);
    const dto = updateIndicativeComponentSchema.parse(req.body) as UpdateIndicativeComponentDTO;
    const data = await indicativeValuationService.updateComponent(indicationId, id, dto);
    successResponse(res, 200, data, "Component updated");
  }
);

/** DELETE /property-indicativeValuation/:indicationId/components/:id */
export const deleteComponent = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const indicationId = Number(req.params.indicationId);
    const id = Number(req.params.id);
    await indicativeValuationService.deleteComponent(indicationId, id);
    successResponse(res, 200, {}, "Component deleted");
  }
);
