import { ArgumentMetadata, Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';

@Injectable()
export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: any) {}

  transform(value: any, metadata: ArgumentMetadata) {
    try {
      // Validate the value against the Zod schema
      this.schema.parse(value);
      return value;
    } catch (error) {
      if (error instanceof ZodError) {
        // If validation fails, throw a BadRequestException with the error message
        throw new BadRequestException(error.errors);
      }
      // In case of any other error, throw a generic BadRequestException
      throw new BadRequestException('Validation failed');
    }
  }
}
