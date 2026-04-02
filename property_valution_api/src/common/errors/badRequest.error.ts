import { AppError, FieldError } from "./app.error";

export class BadRequestError extends AppError {
  constructor(message = "Bad request", errors?: FieldError[]) {
    super(message, 400, "BAD_REQUEST", errors);
  }
}
