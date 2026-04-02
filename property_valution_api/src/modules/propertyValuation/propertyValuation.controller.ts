import { propertyValuationService } from "./propertyValuation.service";
import expressAsyncHandler from "express-async-handler";
import { Request, Response } from "express";
import {
  CreatePropertyValuationDTO,
  valuationFiltersDTO,
  valuationPaginationOptionsDTO,
  ApproveValuationDTO,
  RejectValuationDTO,
  UpdatePropertyValuationDTO,
  reassignValuationSchema,
} from "./propertyValuation.dto";
import { AuthRequest } from "../../common/types/auth.type";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { ValuationMethod, PropertyValuationStatus, WorkflowStatus } from "@prisma/client";
import { successResponse } from "../../common/utils/responseHelper";
import {
  exportPropertyValuationsToExcel,
  importPropertyValuationsFromExcel,
} from "./propertyValuation.excel.service";

const createPropertyValuation = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data: CreatePropertyValuationDTO = {
      ...req.body,
      valuerId: req.user?.id ?? req.body?.valuerId,
    };
    const files = (req as any).files as
      | Record<string, Express.Multer.File[]>
      | Express.Multer.File[]
      | undefined;
    const singleFile = (req as any).file as Express.Multer.File | undefined;
    const valuationPdfFromArray = Array.isArray(files)
      ? files.find((file) => file.fieldname === "valuationPdf")
      : undefined;
    const valuationPdf =
      valuationPdfFromArray ??
      (!Array.isArray(files) ? files?.valuationPdf?.[0] : undefined) ??
      singleFile;
    const hasPropertyId = typeof data.propertyId === "number";
    const hasProperty = !!data.property;

    if (!hasPropertyId && !hasProperty) {
      throw new BadRequestError("Property ID or property data is required");
    }
    if (hasPropertyId && hasProperty) {
      throw new BadRequestError(
        "Provide either propertyId or property data, not both"
      );
    }
    if (!req.user?.id) {
      throw new BadRequestError("Unauthorized");
    }
    const userHierarchyLevel = req.user.roles?.length
      ? Math.min(...req.user.roles.map((r) => r.hierarchyLevel))
      : 99;
    const result = await propertyValuationService.createPropertyValuation(
      data,
      req.user!.id,
      valuationPdf,
      userHierarchyLevel
    );

    successResponse(
      res,
      201,
      { valuation: result.data },
      result.message
    );
    return;
  }
);

const getAllPropertyValuation = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    
    // 1. Helper to safely parse numbers or return undefined
    const toNum = (val: any) => (val ? Number(val) : undefined);
    const toDate = (val: any) => (val ? new Date(val as string) : undefined);
    const toStr = (val: any) => (val ? String(val) : undefined);

    const filter: valuationFiltersDTO = {
      // 1. Search & Core
      search: req.query.search as string | undefined,
      propertyId: toNum(req.query.propertyId),
      
      // 2. Property Details
      propertyName: req.query.propertyName as string | undefined,
      propertyTypeId: toNum(req.query.propertyTypeId),
      valuationMethod: req.query.valuationMethod as ValuationMethod | undefined,
      preparedFor: toStr(req.query.preparedFor),
      purposeOfValuation: toStr(req.query.purposeOfValuation),

      // 3. Workflow
      status: req.query.status as PropertyValuationStatus | undefined,
      workflowStatus: req.query.workflowStatus as WorkflowStatus | undefined,
      valuerId: toNum(req.query.valuerId) ?? toNum(req.query.valuedBy),
      approvedById: toNum(req.query.approvedById) ?? toNum(req.query.approvedBy),

      // 4. Location (New)
      provinceId: toStr(req.query.provinceId),
      districtId: toStr(req.query.districtId),
      communeId: toStr(req.query.communeId),
      villageId: toStr(req.query.villageId),

      // 5. Ranges
      valuationDateFrom: toDate(req.query.valuationDateFrom),
      valuationDateTo: toDate(req.query.valuationDateTo),
      minValue: toNum(req.query.minValue) ?? toNum(req.query.minPrice), // Handle aliases if needed
      maxValue: toNum(req.query.maxValue) ?? toNum(req.query.maxPrice),
    };

    const paginationOptions: valuationPaginationOptionsDTO = {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as "asc" | "desc",
    };

    if (!req.user) {
      throw new Error("Unauthorized: User context missing");
    }

   // A. normalize roles (handle if they are strings or objects)
    const rawRoles = (req.user as any).roles || [];
    const roles: string[] = Array.isArray(rawRoles)
      ? rawRoles.map((r: any) => (typeof r === "string" ? r : r.roleCode || ""))
      : [];

    // B. Calculate Hierarchy Level
    // Level 1=SuperAdmin/Admin, 2=Manager, 3=Valuer, 4=User
    let calculatedLevel = 4; 
    if (roles.includes("SUPER_ADMIN") || roles.includes("ADMIN")) {
      calculatedLevel = 1;
    } else if (roles.includes("PROP_MGR")) {
      calculatedLevel = 2;
    } else if (roles.includes("VALUER")) {
      calculatedLevel = 3;
    }

    const currentUser = {
      id: req.user.id,
      roles: roles,
      hierarchyLevel: calculatedLevel, 
    };

    const result = await propertyValuationService.getAllPropertyValuation(
      filter,
      paginationOptions,
      currentUser
    );

    successResponse(
      res,
      200,
      { valuations: result.data.valuations },
      result.message,
      { pagination: result.pagination }
    );
    return;
  }
);

const getValuationDocumentDownload = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const valuationId = Number(id);
    const version =
      req.query.version !== undefined ? Number(req.query.version) : undefined;

    if (isNaN(valuationId)) {
      throw new BadRequestError("Invalid valuation ID");
    }
    if (req.query.version !== undefined && isNaN(Number(req.query.version))) {
      throw new BadRequestError("Invalid document version");
    }

    const result =
      await propertyValuationService.getValuationDocumentForDownload(
        valuationId,
        { version }
      );

    successResponse(res, 200, result.data, result.message);
    return;
  }
);


const getPropertyValuationById = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const valuationId = Number(id);

    const result = await propertyValuationService.getPropertyValuationById(
      valuationId
    );
    successResponse(
      res,
      200,
      { valuation: result.data },
      result.message
    );
    return;
  }
);

const updatePropertyValuation = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const valuationId = Number(id);

    const userId = req.user?.id;

    if (!userId) {
      throw new BadRequestError("Unauthorized");
    }
    
    // Assuming hierarchyLevel is on the role. We take the "highest" permission (lowest number)
    const userHierarchyLevel = Math.min(
        ...req.user!.roles.map(r => r.hierarchyLevel)
      );

    // FIX: Use the Type (DTO), not the Schema object
    const data: UpdatePropertyValuationDTO = req.body;

    const updateData = await propertyValuationService.updatePropertyValuation(
      valuationId,
      data,
      userId,
      userHierarchyLevel
    );

    successResponse(
      res,
      200,
      { valuation: updateData.data },
      updateData.message
    );
    return;
  }
);

const submitForReview = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
     const valuationId = parseInt(
      Array.isArray(req.params.id) ? (req.params.id[0] ?? "") : (req.params.id ?? ""),
      10
    );

    if (isNaN(valuationId)) {
      throw new BadRequestError("Invalid valuation ID");
    }

    const userId = req.user!.id;

    if (!userId) {
      throw new BadRequestError("Unauthorized");
    }

    const userHierarchyLevel = Math.min(
        ...req.user!.roles.map(r => r.hierarchyLevel)
      );
    

    const result = await propertyValuationService.submitForReview(
      valuationId,
      userId,
      userHierarchyLevel
    );

    successResponse(
      res,
      200,
      { valuation: result.data },
      result.message
    );
    return;
  }
);

const approveValuation = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const valuationId = Number(id);

    if (isNaN(valuationId)) {
      throw new BadRequestError("Invalid valuation ID");
    }

    if (!req.user?.id) {
      throw new BadRequestError("Unauthorized");
    }

    const approvalData: ApproveValuationDTO = {
      approvedById: req.user.id,
      notes: req.body?.notes ?? undefined,
    };
    if (!approvalData.approvedById) {
      throw new BadRequestError("ApprovedBy is required");
    }
    const result = await propertyValuationService.approveValuation(
      valuationId,
      approvalData
    );

    successResponse(
      res,
      200,
      { valuation: result.data },
      result.message
    );
    return;
  }
);
const rejectValuation = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const valuationId = Number(id);
    if (isNaN(valuationId)) {
      throw new BadRequestError("Invalid valuation ID");
    }
    const rejectionData: RejectValuationDTO = {
      rejectedById: req.user!.id,
      rejectionReason: req.body.rejectionReason,
    };

    if (!rejectionData.rejectedById) {
      throw new BadRequestError("RejectedBy is required");
    }
    if (!rejectionData.rejectionReason) {
      throw new BadRequestError("Rejection reason is required");
    }
    const result = await propertyValuationService.rejectValuation(
      valuationId,
      rejectionData
    );
    successResponse(
      res,
      200,
      { valuation: result.data },
      result.message
    );
    return;
  }
);

const reassignValuation = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const valuationId = Number(id);
    const {newValuerId} = req.body;

    if (!req.user?.id) {
      throw new BadRequestError("Unauthorized");
    }
    const result = await propertyValuationService.reassignValuation(
      valuationId,
      newValuerId,
      req.user!.id
    );

    successResponse(res, 200, { valuation: result.data }, result.message);
  }
);

const deletePropertyValuation = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const valuationId = Number(id);

    if (isNaN(valuationId)) {
      throw new BadRequestError("Invalid valuation ID");
    }

    const result = await propertyValuationService.deletePropertyValuation(
      valuationId
    );

    successResponse(res, 200, null, result.message);
    return;
  }
);

const getValuationStatistics = expressAsyncHandler(
  async (req: Request, res: Response) => { 
    const filters = {
      propertyTypeId: req.query.propertyTypeId
        ? parseInt(req.query.propertyTypeId as string)
        : undefined,
      valuationMethod: req.query.valuationMethod as ValuationMethod,
      status: req.query.status as PropertyValuationStatus | undefined,
      workflowStatus: req.query.workflowStatus as WorkflowStatus | undefined,
      yearFrom: req.query.yearFrom
        ? parseInt(req.query.yearFrom as string)
        : undefined,
      yearTo: req.query.yearTo
        ? parseInt(req.query.yearTo as string)
        : undefined,
      valuerId: req.query.valuerId
        ? parseInt(req.query.valuerId as string)
        : undefined,
      provinceId: req.query.provinceId
        ? parseInt(req.query.provinceId as string)
        : undefined,
    };
    const result = await propertyValuationService.getValuationStatistics(
      filters
    );

    successResponse(res, 200, result.data, result.message);
    return;
  }
);

const exportPropertyValuationExcel = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const parsePositiveInt = (value: unknown, field: string) => {
      if (typeof value !== "string") return undefined;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new BadRequestError(`${field} must be a positive integer`);
      }
      return parsed;
    };
    const parseNonNegativeNumber = (value: unknown, field: string) => {
      if (typeof value !== "string") return undefined;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new BadRequestError(`${field} must be a valid number greater than or equal to 0`);
      }
      return parsed;
    };
    const parseDate = (value: unknown, field: string) => {
      if (typeof value !== "string") return undefined;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestError(`${field} must be a valid date`);
      }
      return parsed;
    };
    const parseString = (value: unknown) =>
      typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

    const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
    const workflowStatusRaw =
      typeof req.query.workflowStatus === "string" ? req.query.workflowStatus : undefined;
    const valuationMethodRaw =
      typeof req.query.valuationMethod === "string" ? req.query.valuationMethod : undefined;
    const search = parseString(req.query.search);
    const preparedFor = parseString(req.query.preparedFor);
    const purposeOfValuation = parseString(req.query.purposeOfValuation);
    const provinceId = parseString(req.query.provinceId);
    const districtId = parseString(req.query.districtId);
    const communeId = parseString(req.query.communeId);
    const villageId = parseString(req.query.villageId);
    const propertyIdRaw = parsePositiveInt(req.query.propertyId, "propertyId");
    const valuerIdRaw = parsePositiveInt(req.query.valuerId, "valuerId");
    const propertyTypeIdRaw = parsePositiveInt(req.query.propertyTypeId, "propertyTypeId");
    const minValue = parseNonNegativeNumber(req.query.minValue, "minValue");
    const maxValue = parseNonNegativeNumber(req.query.maxValue, "maxValue");
    const valuationDateFrom = parseDate(req.query.valuationDateFrom, "valuationDateFrom");
    const valuationDateTo = parseDate(req.query.valuationDateTo, "valuationDateTo");

    const normalizedStatus = statusRaw?.trim().toUpperCase();
    const normalizedWorkflowStatus = workflowStatusRaw?.trim().toUpperCase();
    const normalizedValuationMethod = valuationMethodRaw?.trim().toUpperCase();

    if (
      normalizedStatus &&
      !Object.values(PropertyValuationStatus).includes(
        normalizedStatus as PropertyValuationStatus
      )
    ) {
      throw new BadRequestError(
        `Invalid status. Allowed values: ${Object.values(PropertyValuationStatus).join(", ")}`
      );
    }

    if (
      normalizedWorkflowStatus &&
      !Object.values(WorkflowStatus).includes(
        normalizedWorkflowStatus as WorkflowStatus
      )
    ) {
      throw new BadRequestError(
        `Invalid workflowStatus. Allowed values: ${Object.values(WorkflowStatus).join(", ")}`
      );
    }

    if (
      normalizedValuationMethod &&
      !Object.values(ValuationMethod).includes(
        normalizedValuationMethod as ValuationMethod
      )
    ) {
      throw new BadRequestError(
        `Invalid valuationMethod. Allowed values: ${Object.values(ValuationMethod).join(", ")}`
      );
    }

    if (
      minValue !== undefined &&
      maxValue !== undefined &&
      minValue > maxValue
    ) {
      throw new BadRequestError("minValue cannot be greater than maxValue");
    }

    if (
      valuationDateFrom &&
      valuationDateTo &&
      valuationDateFrom > valuationDateTo
    ) {
      throw new BadRequestError("valuationDateFrom cannot be later than valuationDateTo");
    }

    const buffer = await exportPropertyValuationsToExcel({
      status: normalizedStatus as PropertyValuationStatus | undefined,
      workflowStatus: normalizedWorkflowStatus as WorkflowStatus | undefined,
      valuationMethod: normalizedValuationMethod as ValuationMethod | undefined,
      propertyId: propertyIdRaw,
      valuerId: valuerIdRaw,
      propertyTypeId: propertyTypeIdRaw,
      preparedFor,
      purposeOfValuation,
      provinceId,
      districtId,
      communeId,
      villageId,
      valuationDateFrom,
      valuationDateTo,
      minValue,
      maxValue,
      search,
    });
    const payload = Buffer.from(buffer);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"property-valuations-${timestamp}.xlsx\"`
    );
    res.status(200).send(payload);
  }
);

const importPropertyValuationExcel = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      throw new BadRequestError("excelFile is required");
    }

    const summary = await importPropertyValuationsFromExcel(file, req.user?.id);

    successResponse(
      res,
      200,
      { summary },
      `Import completed: ${summary.created} created, ${summary.updated} updated, ${summary.failed} failed`
    );
    return;
  }
);

export {
  createPropertyValuation,
  getAllPropertyValuation,
  getPropertyValuationById,
  getValuationDocumentDownload,
  updatePropertyValuation,
  submitForReview,
  approveValuation,
  rejectValuation,
  reassignValuation,
  deletePropertyValuation,
  getValuationStatistics,
  exportPropertyValuationExcel,
  importPropertyValuationExcel,
};
