export type FieldError = { path: string; message: string };

export class AppError extends Error {
  statusCode: number;
  code: string;
  errors?: FieldError[];

  constructor(
    message: string,
    statusCode = 400,
    code = "BAD_REQUEST",
    errors?: FieldError[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
  }
}
