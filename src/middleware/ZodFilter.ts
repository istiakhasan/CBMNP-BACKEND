import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { ZodError } from "zod";
@Catch(ZodError)
export class ZodFilter<T extends ZodError> implements ExceptionFilter {
  catch(exception: T, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = 400;

    const errorMessages = exception.errors.map(error => ({
      path: error.path.join('.'),
      message: error.message
    }));

    response.status(status).json({
      success: false,
      message: "Validation Error",
      errorMessages: errorMessages,
    });
  }
}
