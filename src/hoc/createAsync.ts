import { HttpStatus } from "@nestjs/common";
import { ApiError } from "../middleware/ApiError";

export async function catchAsync(fn: Function) {
  try {
    return await fn();
  } catch (error) {
    throw new ApiError(
      HttpStatus.INTERNAL_SERVER_ERROR, 
      error.message || 'Something went wrong'
    );
  }
}
