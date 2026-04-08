import { Response } from "express";
import expressAsyncHandler from "express-async-handler";
import { successResponse } from "../../common/utils/responseHelper";
import { BadRequestError } from "../../common/errors/badRequest.error";
import type { AuthRequest } from "../../common/types/auth.type";
import { reportService } from "./report.service";
import type { CreateReportDto, ReportListQueryDto } from "./report.dto";

const requireUser = (req: AuthRequest) => {
  if (!req.user) {
    throw new BadRequestError("Unauthorized");
  }

  return {
    id: req.user.id,
    username: req.user.username,
    email: req.user.email,
    roles: req.user.roles,
    permissions: req.user.permissions,
  };
};

export const listReports = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const currentUser = requireUser(req);
    const result = await reportService.listReports(
      req.query as unknown as ReportListQueryDto,
      currentUser,
    );

    successResponse(
      res,
      200,
      { reports: result.data, summary: result.summary },
      "Reports retrieved successfully",
      { pagination: result.pagination }
    );
  }
);

export const generateReport = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const currentUser = requireUser(req);
    const result = await reportService.generateReport(
      req.body as CreateReportDto,
      currentUser,
    );

    successResponse(
      res,
      201,
      result,
      "Report generated successfully"
    );
  }
);

export const downloadReport = expressAsyncHandler(
  async (req: AuthRequest, res: Response) => {
    const reportId = Number(req.params.id);
    if (Number.isNaN(reportId)) {
      throw new BadRequestError("Invalid report ID");
    }

    const currentUser = requireUser(req);
    const result = await reportService.getReportDownload(reportId, currentUser);

    successResponse(
      res,
      200,
      result,
      "Report download link generated successfully"
    );
  }
);
