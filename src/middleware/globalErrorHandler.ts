import { Catch, ExceptionFilter, ArgumentsHost, HttpStatus, BadRequestException, HttpException } from '@nestjs/common';
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
      const badRequestResponse = error.getResponse();
      const badRequestMessage =
        typeof badRequestResponse === 'string'
          ? badRequestResponse
          : (badRequestResponse as any)?.message || 'Bad Request';
      message = Array.isArray(badRequestMessage) ? badRequestMessage.join(', ') : badRequestMessage;
      errorMessages = [{ path: '', message }];
    } else if (error instanceof HttpException) {
      statusCode = error.getStatus();
      const response = error.getResponse();
      message = typeof response === 'string' ? response : (response as any)?.message || error.message;
      errorMessages = message ? [{ path: '', message: Array.isArray(message) ? message.join(', ') : message }] : [];
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
