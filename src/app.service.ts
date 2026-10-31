import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'CBMNP ERP Shopify integration is active.';
  }
}
