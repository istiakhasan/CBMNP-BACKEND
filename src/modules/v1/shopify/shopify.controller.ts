import { Controller, Post, Req, Headers, BadRequestException, Body, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { ShopifyWebhookService } from './shopify.service';
import { Shopify } from './entities/shopify.entity';
import { catchAsync } from '../../../hoc/createAsync';
import { IResponse } from '../../../util/sendResponse';

@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly shopifyWebhookService: ShopifyWebhookService
    
  ) {}
  @Post('/shopify')
  async handleShopifyWebhook(
    @Req() req, 
    @Headers('X-Shopify-Hmac-Sha256') shopifyHmac: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
  ) {
    const rawBody = req.rawBody; 

    if (!rawBody) {
      throw new BadRequestException('Raw body is missing!');
    }

    const result=await this.shopifyWebhookService.handleShopifyOrderWebhook(rawBody, shopifyHmac,shopDomain);
    return { status: 'success',data:result };
  }
  @Post('/shopify/create')
  async configureShopify(
    @Body() data:Shopify,
    @Req() req:Request
  ) {
    const organizationId=req.headers['x-organization-id']
    return  catchAsync(async():Promise<IResponse<Shopify>>=>{
        const result=await this.shopifyWebhookService.configureShopify({...data,organizationId});
        return {
          message:'Configure Shopify  successfully',
          statusCode:HttpStatus.OK,
          data:result,
          success:true
        }
      })

  }
  
}
