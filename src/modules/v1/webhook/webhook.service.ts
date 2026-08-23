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
     * 3. Resolve internal status (if Steadfast sent one)
     * =====================================================
     *
     * IMPORTANT:
     * We resolve this BEFORE saving, but we do NOT assign it
     * onto the loaded `order` entity directly. The Order entity's
     * `status` relation is eager-loaded, and assigning a stale/partial
     * relation object alongside a manually-changed `statusId` column
     * causes TypeORM to override the raw column back to the old value
     * on save. This was the root cause of statusId not persisting.
     *
     * Fix: use repository.update() with plain columns only, never
     * mixing it with the loaded relation object.
     */

    let internalStatus: OrderStatus | null = null;

    /**
     * Business rule:
     * The order's main `statusId` should ONLY move forward when the
     * courier confirms actual Delivery. Courier-side Hold / Cancel /
     * Pending events are informational only — they are stored in
     * `courierStatus` (see section above) so staff can see them, but
     * they must NOT automatically flip the ERP's own order status.
     * Hold/Cancel of the internal order remains a manual/admin action.
     */
    const AUTO_STATUS_LABELS = new Set(['Delivered']);

    if (status) {
      const internalStatusLabel = this.normalizeStatus(status);

      if (internalStatusLabel && AUTO_STATUS_LABELS.has(internalStatusLabel)) {
        internalStatus = await this.orderStatusRepository.findOne({
          where: {
            label: internalStatusLabel,
          },
        });

        if (!internalStatus) {
          this.logger.warn(
            `Internal order status not found for label: ${internalStatusLabel}`,
          );
        }
      } else if (internalStatusLabel) {
        this.logger.log(
          `Courier reported "${internalStatusLabel}" for invoice ${invoiceNumber} — ` +
            `courierStatus updated, but order statusId left unchanged (manual action required).`,
        );
      }
    }

    /**
     * =====================================================
     * 4. Build the update payload
     * =====================================================
     *
     * Only include fields that were actually present in the
     * webhook payload — everything else stays untouched.
     */

    const updateData: Partial<Order> = {};

    if (consignment_id !== undefined && consignment_id !== null) {
      updateData.consignmentId = String(consignment_id);
    }

    if (finalTrackingCode) {
      updateData.trackingCode = finalTrackingCode;
    }

    if (delivery_charge !== undefined && delivery_charge !== null) {
      updateData.deliveryCharge = Number(delivery_charge) as any;
    }

    if (tracking_message) {
      updateData.trackingMessage = tracking_message;
    }

    if (updated_at) {
      const parsedDate = this.parseDate(updated_at);

      if (parsedDate) {
        updateData.courierUpdatedAt = parsedDate;
      } else {
        this.logger.warn(`Invalid updated_at received: ${updated_at}`);
      }
    }

    if (cod_amount !== undefined && cod_amount !== null) {
      updateData.codAmount = Number(cod_amount) as any;
    }

    if (notification_type) {
      updateData.courierNotificationType = notification_type;
    }

    if (status) {
      updateData.courierStatus = status.trim();
    }

    const previousStatusId = order.statusId;

    if (internalStatus) {
      /**
       * NOTE: On the OrderStatus entity, `value` IS the primary key
       * (@PrimaryGeneratedColumn() value: number;) — there is no
       * separate `id` field. So `internalStatus.value` is correct here.
       *
       * The real bug was NOT this field — it was that `order.statusId`
       * was being changed on an entity loaded with an eager `status`
       * relation, then saved with `.save()`. TypeORM re-derived the FK
       * from the stale relation object and silently reverted `statusId`
       * back to its old value. Using a targeted `.update()` call below
       * (instead of `.save()`) avoids that entirely.
       */
      updateData.statusId = internalStatus.value;
      updateData.previousStatus = String(previousStatusId);

      this.logger.log(
        `Order ${invoiceNumber} status changing: ` +
          `${previousStatusId} -> ${internalStatus.value} (${internalStatus.label})`,
      );

      /**
       * =====================================================
       * Payment settlement on Delivery
       * =====================================================
       *
       * When the courier confirms Delivered, the `cod_amount` in the
       * payload is the cash the courier actually collected from the
       * customer at the doorstep. That amount needs to be added to
       * what was already paid (e.g. an earlier bKash partial payment)
       * so `totalPaidAmount` reflects reality and `paymentStatus`
       * flips from "Partial"/"Pending" to "Paid".
       *
       * We only do this for Delivered — Hold/Cancel never reach here
       * because of the AUTO_STATUS_LABELS whitelist above.
       */
      if (internalStatus.label === 'Delivered') {
        const alreadyPaid = Number(order.totalPaidAmount ?? 0);
        const collectedNow = Number(cod_amount ?? order.codAmount ?? 0);

        const newTotalPaid = alreadyPaid + collectedNow;
        const newReceivable = Math.max(
          Number(order.totalPrice ?? 0) - newTotalPaid,
          0,
        );

        updateData.totalPaidAmount = newTotalPaid as any;
        updateData.totalReceiveAbleAmount = newReceivable as any;
        updateData.paymentStatus = newReceivable === 0 ? 'Paid' : 'Partial';

        this.logger.log(
          `Order ${invoiceNumber} payment settled on delivery: ` +
            `already paid ৳${alreadyPaid} + COD collected ৳${collectedNow} ` +
            `= ৳${newTotalPaid} paid, ৳${newReceivable} remaining, ` +
            `paymentStatus -> ${updateData.paymentStatus}`,
        );
      }
    }

    /**
     * =====================================================
     * 5. Persist via targeted update (no stale relation issues)
     * =====================================================
     */

    await this.orderRepository.update({ id: order.id }, updateData);

    this.logger.log(
      `Order ${order.id} updated successfully. Invoice: ${invoiceNumber}`,
    );

    /**
     * =====================================================
     * 6. Re-fetch to confirm persisted state (also refreshes
     *    the eager `status` relation for an accurate response)
     * =====================================================
     */

    const savedOrder = await this.orderRepository.findOne({
      where: { id: order.id },
    });

    this.logger.log(
      `Order ${order.id} confirmed statusId in DB: ${savedOrder?.statusId}`,
    );

    /**
     * =====================================================
     * 7. Return response
     * =====================================================
     */

    return {
      success: true,
      message: 'Webhook processed successfully',

      invoice: invoiceNumber,

      orderId: order.id,

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