import { Controller, Post, Req, Headers, BadRequestException, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { ShopifyWebhookService } from './shopify.service';
import { Shopify } from './entities/shopify.entity';
import { catchAsync } from '../../../hoc/createAsync';
import { IResponse } from '../../../util/sendResponse';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly shopifyWebhookService: ShopifyWebhookService) {}

  @Post('/shopify')
  @HttpCode(HttpStatus.OK)
  async handleShopifyWebhook(
    @Req() req,
    @Headers('X-Shopify-Hmac-Sha256') shopifyHmac: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
    @Headers('x-shopify-webhook-id') webhookId: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Raw body is missing!');
    if (!shopifyHmac || !shopDomain) throw new BadRequestException('Missing Shopify verification headers');

    const result = await this.shopifyWebhookService.handleShopifyOrderWebhook(rawBody, shopifyHmac, shopDomain, webhookId);
    return { status: 'success', data: result };
  }

  @Post('/shopify/product')
  @HttpCode(HttpStatus.OK)
  async handleProductWebhook(
    @Req() req,
    @Headers('X-Shopify-Hmac-Sha256') shopifyHmac: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Raw body is missing!');

    const result = await this.shopifyWebhookService.handleShopifyProductWebhook(rawBody, shopifyHmac, shopDomain);
    return { status: 'success', data: result };
  }

  @Post('/shopify/product/delete')
  @HttpCode(HttpStatus.OK)
  async handleProductDeleteWebhook(
    @Req() req,
    @Headers('X-Shopify-Hmac-Sha256') shopifyHmac: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Raw body is missing!');

    const result = await this.shopifyWebhookService.handleShopifyProductDeleteWebhook(rawBody, shopifyHmac, shopDomain);
    return { status: 'success', data: result };
  }

  @Post('/shopify/create')
  async configureShopify(@Body() data: Shopify, @Req() req: Request) {
    const organizationId = req.headers['x-organization-id'];
    return catchAsync(async (): Promise<IResponse<Shopify>> => {
      const result = await this.shopifyWebhookService.configureShopify({ ...data, organizationId });
      return {
        message: 'Configure Shopify successfully',
        statusCode: HttpStatus.OK,
        data: result,
        success: true,
      };
    });
  }
}