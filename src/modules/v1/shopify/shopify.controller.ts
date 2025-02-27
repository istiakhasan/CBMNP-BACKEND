import {
  Controller,
  Post,
  Body,
  Headers,
  Res,
} from '@nestjs/common';
import { ShopifyService } from './shopify.service';

import * as crypto from 'crypto';
import { Response } from 'express';
import { OrderService } from '../order/order.service';
import { Order } from '../order/entities/order.entity';

@Controller('shopify')
export class ShopifyController {
  constructor(
    private readonly ordersService: OrderService,
  ) {}

  private readonly shopifySecret =
    'af1f1c3088b22c67e217a87be4463bc7e9ee7411942104515703a284705c8354';

  @Post('webhook')
  async handleWebhook(
    @Headers('x-shopify-hmac-sha256') hmac: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
    try {
      // Verify Shopify HMAC Signature
      const generatedHash = crypto
        .createHmac('sha256', this.shopifySecret)
        .update(JSON.stringify(body), 'utf8')
        .digest('base64');

      if (!hmac || hmac !== generatedHash) {
        console.error('Webhook signature verification failed');
        return res.status(401).json({ message: 'Unauthorized' });
      }

      console.log('Webhook received:', body);

      // ✅ Extract and map Shopify order data to your Order entity
      const orderData:any = {
        orderNumber: body.id.toString(),
        customerId: body.customer?.id?.toString() || null,
        receiverPhoneNumber: body.customer?.phone || null,
        receiverName: `${body.customer?.first_name || ''} ${body.customer?.last_name || ''}`,
        orderSource: 'Shopify',
        orderType: 'E-commerce',
        invoiceNumber: body.order_number?.toString() || null,
        totalPrice: parseFloat(body.total_price) || 0,
        discount: parseFloat(body.total_discounts) || 0,
        totalPaidAmount: parseFloat(body.total_price) || 0,
        totalReceiveAbleAmount: parseFloat(body.total_price) || 0,
        paymentStatus: body.financial_status || 'pending',
        paymentMethod: body.payment_gateway_names?.[0] || 'unknown',
        deliveryDate: body.created_at, // Shopify's order creation date
        receiverAddress: body.shipping_address?.address1 || '',
        receiverDivision: body.shipping_address?.province || '',
        receiverDistrict: body.shipping_address?.city || '',
        receiverThana: body.shipping_address?.zip || '',
        currier: body.shipping_lines?.[0]?.title || '',
        organizationId:'dd724cc0-bfca-4560-9d4f-d51fbd7e509b'
      };

      // ✅ Save the order in the database
      const newOrder = await this.ordersService.createOrder(orderData,'dd724cc0-bfca-4560-9d4f-d51fbd7e509b');

      console.log('Order stored successfully:', newOrder);
      return res.status(200).json({ message: 'Order stored successfully' });

    } catch (error) {
      console.error('Error processing Shopify webhook:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }
}
