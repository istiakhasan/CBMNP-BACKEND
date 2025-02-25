


import {  HttpStatus } from '@nestjs/common';
import { ApiError } from '../middleware/ApiError';

/**
 * A utility function to wrap service calls and handle errors consistently.
 * @param serviceFunction - The service function that performs the operation.
 * @param args - Arguments to pass to the service function.
 * @returns The result of the service function if successful.
 * @throws HttpException - Throws an HTTP exception if an error occurs.
 */
export async function handleServiceOperation(serviceFunction: Function, ...args: any[]) {
  try {
    const result = await serviceFunction(...args);
    return result;
  } catch (error) {
    const message=error?.message ?? "Something went wrong"
    throw new ApiError(
      HttpStatus.INTERNAL_SERVER_ERROR,message
    );
  }
}

