import { HttpStatus } from "@nestjs/common";
import { ApiError } from "src/middleware/ApiError";

export async function catchAsync(fn: Function) {
  try {
    return await fn();
  } catch (error) {
    // Ensure ApiError and HttpStatus are correctly imported
    throw new ApiError(
      HttpStatus.INTERNAL_SERVER_ERROR, 
      error.message || 'Something went wrong'
    );
  }
}
