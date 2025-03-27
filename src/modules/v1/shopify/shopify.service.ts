import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Products } from '../order/entities/products.entity';
import { Order } from '../order/entities/order.entity';
import { Repository } from 'typeorm';
import { generateUniqueOrderNumber } from '../../../util/genarateUniqueNumber';
import { Shopify } from './entities/shopify.entity';

@Injectable()
export class ShopifyWebhookService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Products)
    private readonly productRepository: Repository<Products>,
    @InjectRepository(Shopify)
    private readonly shopifyRepository: Repository<Shopify>,
  ) { }

  async verifyShopifyWebhookSignature(body: string, shopifyHmac: string, shopDomain: string): Promise<boolean> {
    const shop = await this.shopifyRepository.findOne({ where: { domain: shopDomain } });
    if (!shop || !shop.secret) {
      return false;
    }

    const calculatedHmac = crypto
      .createHmac('sha256', shop.secret)
      .update(body, 'utf8')
      .digest('base64');

    return calculatedHmac === shopifyHmac;
  }

  async handleShopifyOrderWebhook(body: string, shopifyHmac: string,shopDomain:string) {
    // if (!this.verifyShopifyWebhookSignature(body, shopifyHmac,shopDomain)) {
    //   throw new BadRequestException('Invalid webhook signature');
    // }

    const shop = await this.shopifyRepository.findOne({ where: { domain: shopDomain } });

    const webhookData = JSON.parse(body)
    // const order = new Order();
    let order: any = {}
    order.orderNumber = webhookData.name; // Shopify order name (e.g., #1001) // Shopify customer ID
    order.receiverPhoneNumber = webhookData.shipping_address?.phone;
    order.receiverName = webhookData.shipping_address?.name;
    order.shippingCharge = parseFloat(webhookData.total_shipping_price_set?.shop_money?.amount || '0');
    order.productValue = parseFloat(webhookData.total_line_items_price_set?.shop_money?.amount || '0');
    order.totalPrice = parseFloat(webhookData.total_price_set?.shop_money?.amount || '0');
    order.discount = parseFloat(webhookData.total_discounts_set?.shop_money?.amount || '0');
    order.paymentStatus = webhookData.financial_status; // e.g., 'voided'
    order.paymentMethod = webhookData.payment_gateway_names?.join(', '); // e.g., 'visa, bogus'
    order.receiverAddress = webhookData.shipping_address?.address1;
    order.receiverDivision = webhookData.shipping_address?.province;
    order.receiverDistrict = webhookData.shipping_address?.city;
    order.receiverThana = ''; // Add logic if needed
    order.onCancelReason = webhookData.cancel_reason; // e.g., 'customer'
    // Save the order to the database


    // // Map and save line items (products)
    const products=[]
    if (webhookData.line_items && webhookData.line_items.length > 0) {
      for (const lineItem of webhookData.line_items) {
        const product:Products | any = {}
        product.productId = "9f1899f6-f0f3-4727-a8ae-bc6a6ef7bd9c";
        product.productQuantity = lineItem.quantity;
        product.productPrice = parseFloat(lineItem.price);
        product.subtotal = parseFloat(lineItem.price) * lineItem.quantity;
        products.push(product)
      }

      order.products=products
    }
    console.log(order,"check");
    // console.log(order, "order1234");



    try {
      const result = await this.orderRepository.save({
        receiverPhoneNumber: webhookData.shipping_address?.phone,
        receiverName: webhookData.shipping_address?.name,
        statusId: 1,
        totalPrice: Number(webhookData.total_line_items_price_set?.shop_money?.amount || '0') + Number(webhookData.total_shipping_price_set?.shop_money?.amount || '0'),
        paymentMethod: webhookData.payment_gateway_names?.join(', '),
        receiverDivision: webhookData.shipping_address?.province,
        receiverDistrict: webhookData.shipping_address?.city,
        receiverThana: "string",
        receiverAddress: webhookData.shipping_address?.address1,
        products: products,
        orderNumber: generateUniqueOrderNumber(),
        shippingCharge: parseFloat(webhookData.total_shipping_price_set?.shop_money?.amount || '0'),
        productValue: parseFloat(webhookData.total_line_items_price_set?.shop_money?.amount || '0'),
        orderSource: "Shopify",
        organizationId:shop.organizationId,
        totalReceiveAbleAmount:Number(webhookData.total_line_items_price_set?.shop_money?.amount || '0') + Number(webhookData.total_shipping_price_set?.shop_money?.amount || '0')
      });
      console.log('Order saved successfully:', result);
    } catch (error) {
      console.error('Error saving order:', error);
    }



    return [];

  }


  async configureShopify(data: Shopify) {
    const result = await this.shopifyRepository.save(data)
    return result
  }
}