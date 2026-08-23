import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SteadfastWebhookDto } from './dto/steadfast-webhook.dto';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../status/entities/status.entity';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    @InjectRepository(OrderStatus)
    private readonly orderStatusRepository: Repository<OrderStatus>,
  ) {}

  async handleSteadfastWebhook(payload: SteadfastWebhookDto) {
    this.logger.log(`Steadfast webhook received: ${JSON.stringify(payload)}`);

    const {
      notification_type,
      consignment_id,
      invoice,
      cod_amount,
      status,
      delivery_charge,
      tracking_code,
      tracking_id,
      tracking_message,
      updated_at,
    } = payload;

    // Steadfast sometimes sends `tracking_code`, sometimes `tracking_id`
    // depending on notification_type. Normalize to a single value.
    const finalTrackingCode = tracking_code ?? tracking_id;

    /**
     * =====================================================
     * 1. Validate invoice
     * =====================================================
     */

    if (!invoice || !invoice.trim()) {
      this.logger.warn('Steadfast webhook received without invoice');

      return {
        success: false,
        message: 'Invoice is required',
      };
    }

    const invoiceNumber = invoice.trim();

    /**
     * =====================================================
     * 2. Find order by invoiceNumber
     * =====================================================
     */

    const order = await this.orderRepository.findOne({
      where: {
        invoiceNumber,
      },
    });

    if (!order) {
      this.logger.warn(`Order not found for invoice: ${invoiceNumber}`);

      return {
        success: false,
        message: 'Order not found',
        invoice: invoiceNumber,
      };
    }

    this.logger.log(
      `Order found. Order ID: ${order.id}, Invoice: ${invoiceNumber}`,
    );

    /**
     * =====================================================
     * 3. Save Steadfast consignment information
     * =====================================================
     */

    if (consignment_id !== undefined && consignment_id !== null) {
      order.consignmentId = String(consignment_id);
    }

    /**
     * =====================================================
     * 4. Save tracking code
     * =====================================================
     *
     * Steadfast payload sometimes has `tracking_code`,
     * sometimes `tracking_id`. Use whichever is present.
     */

    if (finalTrackingCode) {
      order.trackingCode = finalTrackingCode;
    }

    /**
     * =====================================================
     * 5. Save delivery charge
     * =====================================================
     */

    if (delivery_charge !== undefined && delivery_charge !== null) {
      order.deliveryCharge = Number(delivery_charge);
    }

    /**
     * =====================================================
     * 6. Save tracking message
     * =====================================================
     */

    if (tracking_message) {
      order.trackingMessage = tracking_message;
    }

    /**
     * =====================================================
     * 7. Save courier updated time
     * =====================================================
     */

    if (updated_at) {
      const parsedDate = this.parseDate(updated_at);

      if (parsedDate) {
        order.courierUpdatedAt = parsedDate;
      } else {
        this.logger.warn(`Invalid updated_at received: ${updated_at}`);
      }
    }

    /**
     * =====================================================
     * 8. Save COD amount
     * =====================================================
     */

    if (cod_amount !== undefined && cod_amount !== null) {
      order.codAmount = Number(cod_amount);
    }

    /**
     * =====================================================
     * 9. Save notification type
     * =====================================================
     */

    if (notification_type) {
      order.courierNotificationType = notification_type;
    }

    /**
     * =====================================================
     * 10. Save original Steadfast status
     * =====================================================
     *
     * Example:
     *
     * Delivered
     * Cancelled
     * Pending
     * Hold
     */

    if (status) {
      order.courierStatus = status.trim();
    }

    /**
     * =====================================================
     * 11. Convert Steadfast status
     *     to internal OrderStatus
     * =====================================================
     */

    let internalStatus: OrderStatus | null = null;

    if (status) {
      const internalStatusLabel = this.normalizeStatus(status);

      if (internalStatusLabel) {
        /**
         * Find:
         *
         * order_status.label
         *
         * Example:
         *
         * Delivered
         * Cancel
         * Hold
         * Pending
         */

        internalStatus = await this.orderStatusRepository.findOne({
          where: {
            label: internalStatusLabel,
          },
        });

        if (internalStatus) {
          /**
           * order_status.value
           *        ↓
           * orders.statusId
           */

          order.statusId = internalStatus.value;

          this.logger.log(
            `Order ${invoiceNumber} status changed: ` +
              `${internalStatus.label} (${internalStatus.value})`,
          );
        } else {
          this.logger.warn(
            `Internal order status not found for label: ${internalStatusLabel}`,
          );
        }
      }
    }

    /**
     * =====================================================
     * 12. Save order
     * =====================================================
     */

    const savedOrder = await this.orderRepository.save(order);

    this.logger.log(
      `Order ${savedOrder.id} updated successfully. ` +
        `Invoice: ${invoiceNumber}`,
    );

    /**
     * =====================================================
     * 13. Return response
     * =====================================================
     */

    return {
      success: true,
      message: 'Webhook processed successfully',

      invoice: invoiceNumber,

      orderId: savedOrder.id,

      consignment_id: consignment_id ?? null,

      steadfast_status: status ?? null,

      internal_status: internalStatus
        ? {
            value: internalStatus.value,
            label: internalStatus.label,
          }
        : null,

      tracking_code: finalTrackingCode ?? null,

      notification_type: notification_type ?? null,
    };
  }

  /**
   * =====================================================
   * Normalize Steadfast Status
   * =====================================================
   *
   * Steadfast status
   *        ↓
   * Internal OrderStatus.label
   *
   * Pending
   *        ↓
   * Pending
   *
   * Delivered
   *        ↓
   * Delivered
   *
   * Cancelled
   *        ↓
   * Cancel
   *
   * Hold
   *        ↓
   * Hold
   */

  private normalizeStatus(status?: string): string | null {
    if (!status) {
      return null;
    }

    const normalized = status
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');

    const statusMap: Record<string, string> = {
      /**
       * Pending
       */

      pending: 'Pending',

      in_review: 'Pending',

      delivered_approval_pending: 'Pending',

      partial_delivered_approval_pending: 'Pending',

      cancelled_approval_pending: 'Pending',

      unknown_approval_pending: 'Pending',

      /**
       * Delivered
       */

      delivered: 'Delivered',

      partial_delivered: 'Delivered',

      /**
       * Cancel
       */

      cancelled: 'Cancel',

      canceled: 'Cancel',

      /**
       * Hold
       */

      hold: 'Hold',

      /**
       * Unknown
       */

      unknown: 'Pending',
    };

    const mappedStatus = statusMap[normalized];

    /**
     * Unknown status হলে order status
     * পরিবর্তন করব না।
     */

    if (!mappedStatus) {
      this.logger.warn(`Unknown Steadfast status received: "${status}"`);

      return null;
    }

    return mappedStatus;
  }

  /**
   * =====================================================
   * Parse Date
   * =====================================================
   *
   * Steadfast example:
   *
   * 2025-03-02 12:45:30
   *
   * এটাকে Date object-এ convert করা হবে।
   */

  private parseDate(dateString: string): Date | null {
    if (!dateString) {
      return null;
    }

    /**
     * JavaScript কিছু ক্ষেত্রে
     * "2025-03-02 12:45:30"
     * parse করতে পারে।
     *
     * আমরা safer parsing করছি।
     */

    const normalizedDate = dateString.includes('T')
      ? dateString
      : dateString.replace(' ', 'T');

    const date = new Date(normalizedDate);

    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  }
}