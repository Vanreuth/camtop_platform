import type { Response } from "express";

export type PaginationArgs = {
  page: number;
  limit: number;
  total: number;
};

export const successResponse = <T>(
  res: Response,
  statusCode: number,
  data: T,
  message = "Success",
  options?: {
    pagination?: Pagination | PaginationArgs;
    extra?: Record<string, any>; // optional: add other top-level fields
  }
) => {
  const pagination = options?.pagination
    ? "totalPages" in options.pagination
      ? options.pagination
      : buildPagination(options.pagination)
    : undefined;

  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(pagination ? { pagination } : {}),
    ...(options?.extra ? options.extra : {}),
  });
};

export const errorResponse = (
  res: Response,
  statusCode: number,
  message = "Something went wrong",
  code = "ERROR",
  errors: Array<{ path?: string; message: string }> = []
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    code,
    errors,
  });
};
 type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};
 function buildPagination(args: PaginationArgs): Pagination {
  const page = Math.max(args.page, 1);
  const limit = Math.max(args.limit, 1);
  const total = Math.max(args.total, 0);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

