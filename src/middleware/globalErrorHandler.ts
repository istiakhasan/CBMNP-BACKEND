import { Catch, ExceptionFilter, ArgumentsHost, HttpStatus, BadRequestException } from '@nestjs/common';
import { ValidationError } from 'yup';
import { ApiError } from './ApiError';
import { IGenericErrorMessage } from 'src/interface/error';


@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    // console.log(`🐱‍🏍 globalErrorHandler ~~`, { error })

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong !';
    let errorMessages: IGenericErrorMessage[] = [];

    if (error instanceof ApiError) {
      statusCode = error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      message = error.message || 'Internal server error';
      errorMessages = error.message ? [{ path: '', message: error.message }] : [];
    } else if (error instanceof ValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Validation error';
      errorMessages = error.inner.map(err => ({
        path: err.path,
        message: err.message,
      }));
    } else if (error instanceof BadRequestException) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Bad Request';
      errorMessages = error.getResponse()['message'] ? [{ path: '', message: error.getResponse()['message'] }] : [];
    } else if (error instanceof Error) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = error.message || 'Internal server error';
      errorMessages = error.message ? [{ path: '', message: error.message }] : [];
    }
  
    response.status(statusCode).json({
      statusCode,
      success: false,
      message,
      errorMessages,
      stack: error.stack,
    });
  }
}
