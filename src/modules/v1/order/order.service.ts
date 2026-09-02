import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import * as ExcelJS from 'exceljs';
import { Logger } from '@nestjs/common';
import { Products } from './entities/products.entity';
import paginationHelpers from '../../../helpers/paginationHelpers';
import { plainToInstance } from 'class-transformer';
import { Product } from '../product/entity/product.entity';
import { OrderStatus } from '../status/entities/status.entity';
import { Customers } from '../customers/entities/customers.entity';
import { In } from 'typeorm';
import { Users } from '../user/entities/user.entity';
import { ApiError } from '../../../middleware/ApiError';
import { PaymentHistory } from './entities/paymentHistory.entity';
import { OrdersLog } from './entities/orderlog.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import { DataSource } from 'typeorm';
import { RequisitionService } from '../requsition/requsition.service';
import axios from 'axios';
import { DeliveryPartner } from '../delivery-partner/entities/delivery-partner.entity';
import { OrderProductReturn } from './entities/return_damage.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Response } from 'express';
import * as _ from 'lodash';
import { OrderExchange } from './entities/orderExchannge.entity';

/**
 * ============================================================================
 * QUANTITY-INTEGRITY FIX NOTES (read this before touching inventory logic)
 * ============================================================================
 * Root causes of the mismatches that were happening, and the fix applied:
 *
 * 1) Several places called `this.inventoryRepository.increment(...)` /
 *    `this.InventoryItemItemRepository.increment(...)` etc. INSIDE a method
 *    that had already opened a `queryRunner` transaction. Those repository
 *    calls run on the DEFAULT (auto-commit) connection, NOT on
 *    `queryRunner.manager` — so they were never actually part of the
 *    transaction. If anything later in that same method threw and the
 *    transaction rolled back, those inventory changes were NOT undone,
 *    leaving orderQue/hoildQue/processing/stock permanently wrong.
 *    FIX: every write inside a transactional method now goes through
 *    `queryRunner.manager.increment/decrement/update/save(...)`, never the
 *    injected repository directly.
 *
 * 2) Read-then-compute-then-write patterns (e.g. `changeHoldStatus`,
 *    `returnOrders`) fetched a row, added/subtracted in JS, then wrote the
 *    computed value back — with NO row lock. Two bulk actions running at the
 *    same time on the same product/location would both read the same base
 *    value and one update would silently overwrite the other (lost update).
 *    FIX: every inventory/inventoryItem row that is going to be
 *    read-then-written is fetched with `.setLock('pessimistic_write')`
 *    inside the transaction, and wherever possible we use atomic
 *    `increment`/`decrement` instead of read-add-write.
 *
 * 3) Some methods (`createOrder`, `createPosOrder`, `update`, `addPayment`)
 *    had NO transaction at all around order-write + inventory-write, so a
 *    crash between the two steps left the DB inconsistent.
 *    FIX: wrapped in a single `queryRunner` transaction each.
 *
 * 4) `changeStatusBulk` mixed a `try { ... queryRunner transaction ... }`
 *    block with calls to `this.requisitionService.createRequisition(...)`
 *    for statusId === 5 INSIDE the per-product loop (so it fires once per
 *    product line instead of once per chunk) and `this.orderRepository`
 *    (non-transactional) instead of `queryRunner.manager`.
 *    FIX: moved requisition creation + order timestamp updates outside the
 *    per-product loop (once per chunk), and switched all writes to
 *    `queryRunner.manager`. NOTE: `RequisitionService.createRequisition`
 *    itself still opens its own separate transaction — if you need it to be
 *    atomic with the inventory changes here too, that method needs to be
 *    changed to optionally accept an `EntityManager` so it can run inside
 *    this same `queryRunner`. That is outside this file's scope, flagged
 *    with a TODO at the call site.
 *
 * 5) COURIER RECONCILIATION RACE (fixed here):
 *    `sendOrdersToSteadfast` -> `reconcileWithSteadfast` used to do a SINGLE
 *    status_by_invoice check with only one retry 2s later, then treated a
 *    404/empty result as "genuinely failed" and called
 *    `revertFailedCourierOrders` — reverting status back to the pre-dispatch
 *    status (e.g. Packing) AND restoring inventory. But Steadfast creates
 *    bulk orders ASYNCHRONOUSLY on their side, so a 2s window is often too
 *    short: the order shows up moments later, while our ERP has already
 *    reverted status + double-restored inventory, with nothing left to ever
 *    re-check it. FIX: `reconcileWithSteadfast` now retries with backoff
 *    (2s/5s/15s) before deciding "failed", and if it still can't resolve it
 *    leaves the order untouched (does NOT revert) instead of guessing. A new
 *    `reconcileRevertedCourierOrders` safety-net job re-checks orders that
 *    WERE reverted, and if they're actually found at the courier afterward,
 *    corrects status back to In-Transit and re-deducts the falsely restored
 *    inventory via `correctFalselyRevertedOrder`.
 *
 * General rule applied everywhere below: "one business operation = one
 * queryRunner transaction; every DB write inside it goes through
 * queryRunner.manager; every row that is read then conditionally
 * incremented/created is locked with pessimistic_write."
 * ============================================================================
 */

/**
 * ============================================================================
 * ADDITIONAL FIXES (this pass) — no API/response shape changes, backend only
 * ============================================================================
 * A) changeHoldStatus: `order.previousStatus` was compared with
 *    `=== String(OrderStatusId.Approved)` / `=== String(OrderStatusId.Store)`
 *    / etc., while a few lines later in the SAME method it's cast with
 *    `+order.previousStatus` (i.e. treated as numeric). Whichever type the
 *    column actually round-trips as, the two treatments can't both be right
 *    — and in practice the string-equality branches were silently failing to
 *    match, so hold -> process/store inventory reconciliation only ever ran
 *    via the `!previousStatus` fallback. FIX: normalize once with
 *    `Number(order.previousStatus)` and compare against the enum.
 *
 * B) changeHoldStatus: the final `manager.update(Order, ...)` that sets the
 *    order's resulting statusId was nested INSIDE the per-product loop, so
 *    it fired once per product line (harmless but wasteful) and, worse,
 *    never fired at all for an order with zero product rows. FIX: moved it
 *    outside the product loop so it runs exactly once per order.
 *
 * C) processOrdersChunk: cancelling an order that was previously on HOLD had
 *    no matching branch (only Approved and Store/Packing were handled), so
 *    `hoildQue` was never released on cancel-from-hold and stayed
 *    permanently inflated. FIX: added the missing branch, mirroring the
 *    existing cancel branches.
 *
 * D) downloadOrdersExcel: the courier (`currier`) filter was applied to the
 *    COUNT query (used for the "too many records" guard) but missing from
 *    the actual export/batch query, so the exported file could silently
 *    include orders from couriers the caller filtered out. FIX: applied the
 *    same filter to the batch query.
 *
 * E) update(): `totalReceivableAmount = grandTotal - rest.totalPaidAmount`
 *    became `NaN` whenever the caller didn't send `totalPaidAmount` in the
 *    payload. FIX: fall back to the existing order's stored value.
 * ============================================================================
 */

/**
 * Canonical mapping of the `order_status` table (as confirmed against the
 * live data — DO NOT reorder/renumber these; the numeric values must match
 * the `status` table's `value` column exactly):
 *
 *   1  Pending
 *   2  Approved         (a.k.a. "Process" in older code comments)
 *   3  Hold
 *   4  Cancel
 *   5  Store
 *   6  Packing
 *   7  In-transit
 *   8  Delivered
 *   9  Unreachable
 *   10 Returned
 *   11 Pending-Return
 *   12 Partial-Return
 *   13 Damage
 *
 * Using this enum instead of bare numbers everywhere makes it impossible to
 * accidentally type the wrong statusId in a new `if (data.statusId === X)`
 * branch, and makes every inventory-affecting branch self-documenting.
 */
export enum OrderStatusId {
  Pending = 1,
  Approved = 2,
  Hold = 3,
  Cancel = 4,
  Store = 5,
  Packing = 6,
  InTransit = 7,
  Delivered = 8,
  Unreachable = 9,
  Returned = 10,
  PendingReturn = 11,
  PartialReturn = 12,
  Damage = 13,
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(OrderStatus)
    private readonly statusRepository: Repository<OrderStatus>,
    @InjectRepository(Customers)
    private readonly customerRepository: Repository<Customers>,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    @InjectRepository(Products)
    private readonly productsRepository: Repository<Products>,
    @InjectRepository(PaymentHistory)
    private readonly paymentHistoryRepository: Repository<PaymentHistory>,
    @InjectRepository(OrdersLog)
    private readonly orderLogsRepository: Repository<OrdersLog>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @InjectRepository(InventoryItem)
    private readonly InventoryItemItemRepository: Repository<InventoryItem>,
    @InjectRepository(DeliveryPartner)
    private readonly deliveryPartnerRepository: Repository<DeliveryPartner>,
    @InjectRepository(OrderProductReturn)
    private readonly orderProductReturnRepository: Repository<OrderProductReturn>,
    @InjectRepository(OrderExchange)
    private readonly OrderExchange: Repository<OrderExchange>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(OrderExchange)
    private readonly orderExchangeRepository: Repository<OrderExchange>,

    private readonly requisitionService: RequisitionService,
  ) {}

  // =========================================================================
  // Shared inventory helpers — ALWAYS pass the queryRunner's EntityManager
  // (`manager`) so these participate in the caller's transaction. Never call
  // these with a manager that isn't the one you started your transaction on.
  // =========================================================================

  /** Row-locks (or returns null if missing) an Inventory row for safe read-modify-write. */
  private async lockInventory(
    manager: EntityManager,
    productId: string,
  ): Promise<Inventory | null> {
    return manager
      .createQueryBuilder(Inventory, 'inventory')
      .setLock('pessimistic_write')
      .where('inventory.productId = :productId', { productId })
      .getOne();
  }

  /** Row-locks (or returns null if missing) an InventoryItem row for safe read-modify-write. */
  private async lockInventoryItem(
    manager: EntityManager,
    productId: string,
    locationId: string,
  ): Promise<InventoryItem | null> {
    if (!locationId) return null;
    return manager
      .createQueryBuilder(InventoryItem, 'item')
      .setLock('pessimistic_write')
      .where('item.productId = :productId AND item.locationId = :locationId', {
        productId,
        locationId,
      })
      .getOne();
  }

  /**
   * Locks the Inventory row for productId; creates it (all counters at 0) if
   * it doesn't exist yet. Always returns a locked, existing row.
   */
  private async ensureInventory(
    manager: EntityManager,
    productId: string,
    organizationId: string,
  ): Promise<Inventory> {
    let inventory = await this.lockInventory(manager, productId);
    if (!inventory) {
      try {
        await manager.save(Inventory, {
          productId,
          organizationId,
          orderQue: 0,
          hoildQue: 0,
          processing: 0,
          stock: 0,
        });
      } catch {
        // Ignore: another concurrent transaction may have inserted it first
        // (unique constraint on productId assumed). We re-fetch + lock below
        // regardless of which branch actually created the row.
      }
      inventory = await this.lockInventory(manager, productId);
      if (!inventory) {
        throw new ApiError(
          HttpStatus.INTERNAL_SERVER_ERROR,
          `Failed to create/lock inventory row for product ${productId}`,
        );
      }
    }
    return inventory;
  }

  /**
   * Locks the InventoryItem row for (productId, locationId); creates it
   * (all counters at 0) if missing. Always returns a locked, existing row.
   */
  private async ensureInventoryItem(
    manager: EntityManager,
    productId: string,
    locationId: string,
    inventoryId: string,
  ): Promise<InventoryItem> {
    if (!locationId) {
      throw new BadRequestException(
        `Location is required to manage inventory for product ${productId}`,
      );
    }
    let item = await this.lockInventoryItem(manager, productId, locationId);
    if (!item) {
      try {
        const created = manager.create(InventoryItem, {
          productId,
          locationId,
          quantity: 0,
          orderQue: 0,
          hoildQue: 0,
          processing: 0,
          inventoryId,
        });
        await manager.save(InventoryItem, created);
      } catch {
        // Concurrent creation race — fall through to re-fetch + lock.
      }
      item = await this.lockInventoryItem(manager, productId, locationId);
      if (!item) {
        throw new ApiError(
          HttpStatus.INTERNAL_SERVER_ERROR,
          `Failed to create/lock inventory item for product ${productId} at location ${locationId}`,
        );
      }
    }
    return item;
  }

  // ---------- Shared helper: organization এর prefix বের করা ----------
  private async getOrganizationPrefix(
    manager: EntityManager,
    organizationId: string,
  ): Promise<string> {
    const organization = await manager.findOne(Organization, {
      where: { id: organizationId },
    });
    return organization?.invoicePrefix || 'ORD';
  }

  // ---------- Order Number ----------
  async generateOrderNumber(organizationId: string): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const prefix = await this.getOrganizationPrefix(manager, organizationId);

      const lastOrder = await manager
        .createQueryBuilder(Order, 'order')
        .setLock('pessimistic_write')
        .where('order.organizationId = :organizationId', { organizationId })
        .andWhere('order.orderNumber LIKE :prefix', { prefix: `${prefix}-%` })
        .orderBy('order.id', 'DESC')
        .take(1)
        .getOne();

      let nextNumber = 10000; // order number এর default starting point আগের মতোই রাখলাম
      if (lastOrder?.orderNumber) {
        const lastNumStr = lastOrder.orderNumber.replace(`${prefix}-`, '');
        const lastNum = parseInt(lastNumStr, 10);
        if (!isNaN(lastNum)) nextNumber = lastNum + 1;
      }

      // 8-digit zero-padded number, e.g. 00010000, 00010001 ...
      return `${prefix}-${nextNumber.toString().padStart(8, '0')}`;
    });
  }

  // ---------- Invoice Number ----------
  async generateInvoiceNumber(organizationId: string): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const prefix = await this.getOrganizationPrefix(manager, organizationId);

      const lastOrder = await manager
        .createQueryBuilder(Order, 'order')
        .setLock('pessimistic_write')
        .where('order.organizationId = :organizationId', { organizationId })
        .andWhere('order.invoiceNumber LIKE :prefix', { prefix: `${prefix}-%` })
        .orderBy('order.id', 'DESC')
        .take(1)
        .getOne();

      let nextNumber = 1;
      if (lastOrder?.invoiceNumber) {
        const lastNumStr = lastOrder.invoiceNumber.replace(`${prefix}-`, '');
        const lastNum = parseInt(lastNumStr, 10);
        if (!isNaN(lastNum)) nextNumber = lastNum + 1;
      }

      // 8-digit zero-padded number, e.g. 00000001, 00000002 ...
      return `${prefix}-${nextNumber.toString().padStart(8, '0')}`;
    });
  }

  // =========================================================================
  // CREATE ORDER — now a single transaction: order + logs + inventory all
  // commit or roll back together. Inventory rows are locked before write.
  // =========================================================================
  async createOrder(payload: Order, organizationId: string) {
    const {
      customerId,
      receiverPhoneNumber,
      products,
      discount = 0,
      paymentHistory = [],
      shippingCharge = 0,
      ...rest
    } = payload;

    if (!products || products.length === 0) {
      throw new Error('Order must include at least one product');
    }

    if (
      !organizationId ||
      !(await this.organizationRepository.findOne({
        where: { id: organizationId },
      }))
    ) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'You are not authorized ');
    }

    if ((payload?.statusId === OrderStatusId.Approved || payload?.statusId === OrderStatusId.Hold) && !rest?.locationId) {
      throw new BadRequestException('Location is required for this order status');
    }

    // Order/invoice numbers are generated in their own short-lived
    // transactions (see generateOrderNumber/generateInvoiceNumber) so we
    // don't hold the main transaction's locks any longer than necessary.
    // A rollback below simply "burns" a number, which is fine — numbers only
    // need to be unique, not gapless.
    const orderNumber = await this.generateOrderNumber(organizationId);
    const incrementedId = await this.generateInvoiceNumber(organizationId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const manager = queryRunner.manager;

    try {
      const validatedProducts: any[] = [];
      let productValue = 0;

      for (const product of products) {
        const existingProduct = await manager.findOne(Product, {
          where: { id: product.productId },
        });
        if (!existingProduct) {
          throw new NotFoundException(
            `Product with ID ${product.productId} not found`,
          );
        }

        const subtotal = product.productQuantity * existingProduct.salePrice;
        productValue += subtotal;

        validatedProducts.push({
          productId: product.productId,
          productQuantity: product.productQuantity,
          productPrice: existingProduct.salePrice,
          subtotal,
        });
      }

      const totalPaidAmount = paymentHistory.reduce(
        (total, payment) => total + Number(payment.paidAmount),
        0,
      );
      const grandTotal =
        productValue + Number(shippingCharge) - Number(discount);
      const totalReceivableAmount = grandTotal - totalPaidAmount;

      const result = await manager.save(Order, {
        orderNumber,
        paymentHistory: paymentHistory,
        customerId,
        receiverPhoneNumber,
        products: validatedProducts,
        currier: payload.currier,
        orderSource: payload.orderSource,
        shippingCharge,
        totalPrice: grandTotal,
        productValue,
        totalPaidAmount,
        totalReceiveAbleAmount: totalReceivableAmount,
        discount,
        invoiceNumber: incrementedId,
        organizationId,
        ...rest,
      });

      await manager.save(OrdersLog, {
        orderId: result.id,
        agentId: payload.agentId,
        action: 'The Order created',
        previousValue: null,
      });

      // ---- statusId 2: PROCESS -> bump orderQue ----
      if (payload?.statusId === OrderStatusId.Approved) {
        for (const item of products) {
          const { productId, productQuantity } = item;
          const inventory = await this.ensureInventory(
            manager,
            productId,
            organizationId,
          );
          await manager.increment(
            Inventory,
            { productId },
            'orderQue',
            productQuantity,
          );
          await this.ensureInventoryItem(
            manager,
            productId,
            rest.locationId,
            inventory.id,
          );
          await manager.increment(
            InventoryItem,
            { productId, locationId: rest.locationId },
            'orderQue',
            productQuantity,
          );
        }
      }

      // ---- statusId 3: HOLD -> bump hoildQue ----
      if (payload?.statusId === OrderStatusId.Hold) {
        for (const item of products) {
          const { productId, productQuantity } = item;
          const inventory = await this.ensureInventory(
            manager,
            productId,
            organizationId,
          );
          await manager.increment(
            Inventory,
            { productId },
            'hoildQue',
            productQuantity,
          );
          await this.ensureInventoryItem(
            manager,
            productId,
            rest.locationId,
            inventory.id,
          );
          await manager.increment(
            InventoryItem,
            { productId, locationId: rest.locationId },
            'hoildQue',
            productQuantity,
          );
        }
      }

      await queryRunner.commitTransaction();
      return result;
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof ApiError ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to create order',
      );
    } finally {
      await queryRunner.release();
    }
  }

  // =========================================================================
  // CREATE POS ORDER — same single-transaction treatment.
  // =========================================================================
  async createPosOrder(payload: Order, organizationId: string) {
    const {
      customerId,
      receiverPhoneNumber,
      products,
      discount = 0,
      paymentHistory = [],
      shippingCharge = 0,
      ...rest
    } = payload;

    if (!products || products.length === 0) {
      throw new Error('Order must include at least one product');
    }

    if (
      !organizationId ||
      !(await this.organizationRepository.findOne({
        where: { id: organizationId },
      }))
    ) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'You are not authorized ');
    }

    if (payload?.statusId === OrderStatusId.Delivered && !rest?.locationId) {
      throw new BadRequestException('Location is required for this order status');
    }

    const orderNumber = await this.generateOrderNumber(organizationId);
    const incrementedId = await this.generateInvoiceNumber(organizationId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const manager = queryRunner.manager;

    try {
      const validatedProducts: any[] = [];
      let productValue = 0;

      for (const product of products) {
        const existingProduct = await manager.findOne(Product, {
          where: { id: product.productId },
        });
        if (!existingProduct) {
          throw new NotFoundException(
            `Product with ID ${product.productId} not found`,
          );
        }

        const subtotal = product.productQuantity * existingProduct.salePrice;
        productValue += subtotal;

        validatedProducts.push({
          productId: product.productId,
          productQuantity: product.productQuantity,
          productPrice: existingProduct.salePrice,
          subtotal,
        });
      }

      const totalPaidAmount = paymentHistory.reduce(
        (total, payment) => total + Number(payment.paidAmount),
        0,
      );
      const grandTotal =
        productValue + Number(shippingCharge) - Number(discount);
      const totalReceivableAmount = grandTotal - totalPaidAmount;

      const result = await manager.save(Order, {
        orderNumber,
        paymentHistory: paymentHistory,
        customerId,
        receiverPhoneNumber,
        products: validatedProducts,
        currier: payload.currier,
        orderSource: payload.orderSource,
        shippingCharge,
        totalPrice: grandTotal,
        productValue,
        totalPaidAmount,
        totalReceiveAbleAmount: totalReceivableAmount,
        discount,
        invoiceNumber: incrementedId,
        organizationId,
        ...rest,
      });

      await manager.save(OrdersLog, {
        orderId: result.id,
        agentId: payload.agentId,
        action: 'The Order created',
        previousValue: null,
      });

      // ---- statusId 8: POS instant sale -> decrement stock directly ----
      if (payload?.statusId === OrderStatusId.Delivered) {
        for (const item of products) {
          const { productId, productQuantity } = item;
          const inventory = await this.ensureInventory(
            manager,
            productId,
            organizationId,
          );
          await manager.decrement(
            Inventory,
            { productId },
            'stock',
            productQuantity,
          );
          await this.ensureInventoryItem(
            manager,
            productId,
            rest.locationId,
            inventory.id,
          );
          await manager.decrement(
            InventoryItem,
            { productId, locationId: rest.locationId },
            'quantity',
            productQuantity,
          );
        }
      }

      await queryRunner.commitTransaction();

      return await manager.findOne(Order, {
        where: { id: result.id },
        relations: {
          products: { product: true },
        },
      });
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof ApiError ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to create POS order',
      );
    } finally {
      await queryRunner.release();
    }
  }

 async getOrders(
    options,
    filterOptions,
    organizationId,
    includeProducts = false,
  ) {
    const { page, limit, sortBy, sortOrder, skip } = paginationHelpers(options);
    const queryBuilder = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId });

    if (includeProducts) {
      queryBuilder.leftJoinAndSelect('orders.products', 'products');
      queryBuilder.leftJoinAndSelect('products.product', 'product');
    }
   if (filterOptions?.searchTerm) {
  const searchTerm = `%${filterOptions.searchTerm.toString().trim()}%`;

  queryBuilder.leftJoin('orders.customer', 'customer');

  queryBuilder.andWhere(
    `(
      orders.invoiceNumber LIKE :searchTerm
      OR orders.receiverPhoneNumber LIKE :searchTerm
      OR customer.customerPhoneNumber LIKE :searchTerm
    )`,
    {
      searchTerm,
    },
  );
}

    if (filterOptions?.startDate && filterOptions?.endDate) {
      queryBuilder.andWhere(
        'orders.intransitTime BETWEEN :startDate AND :endDate',
        {
          startDate: new Date(filterOptions.startDate),
          endDate: new Date(filterOptions.endDate),
        },
      );
    }
    if (filterOptions?.createdAtStart && filterOptions?.createdAtEnd) {
      queryBuilder.andWhere(
        'orders.createdAt BETWEEN :createdAtStart AND :createdAtEnd',
        {
          createdAtStart: new Date(filterOptions.createdAtStart),
          createdAtEnd: new Date(filterOptions.createdAtEnd),
        },
      );
    }

    // filter by products
    if (filterOptions?.productId) {
      queryBuilder.leftJoin('orders.products', 'product');
    }
    let productIds = filterOptions?.productId;
    if (productIds) {
      productIds = Array.isArray(productIds) ? productIds : [productIds];
      queryBuilder.andWhere('product.productId IN (:...productIds)', {
        productIds,
      });
    }
    let statusIdss = filterOptions?.statusId;
    if (statusIdss) {
      statusIdss = Array.isArray(statusIdss) ? statusIdss : [statusIdss];
      statusIdss = statusIdss.map(Number); // Convert to number[]
      queryBuilder.andWhere('orders.statusId IN (:...statusIdss)', {
        statusIdss,
      });
    }
    let curierIds = filterOptions?.currier;
    if (curierIds) {
      curierIds = Array.isArray(curierIds) ? curierIds : [curierIds];
      queryBuilder.andWhere('orders.currier IN (:...curierIds)', {
        curierIds,
      });
    }

    let locationIds = filterOptions?.locationId;
    if (locationIds) {
      locationIds = Array.isArray(locationIds) ? locationIds : [locationIds];
      queryBuilder.andWhere('orders.locationId IN (:...locationIds)', {
        locationIds,
      });
    }

    /**
     * =====================================================
     * Delivery payment status filter — DERIVED, not a raw column
     * =====================================================
     * (unchanged business logic — see original comments)
     */
    if (filterOptions?.paymentStatus) {
      const hasReturnSql = `EXISTS (
        SELECT 1 FROM order_product_returns opr
        WHERE opr."orderId" = orders.id
      )`;

      switch (filterOptions.paymentStatus) {
        case 'Partial':
          queryBuilder.andWhere(hasReturnSql);
          break;

        case 'Paid':
          queryBuilder.andWhere(`NOT ${hasReturnSql}`);
          queryBuilder.andWhere(
            'COALESCE(orders.totalPaidAmount, 0) >= orders.totalPrice',
          );
          break;

        case 'Pending':
          queryBuilder.andWhere(`NOT ${hasReturnSql}`);
          queryBuilder.andWhere(
            'COALESCE(orders.totalPaidAmount, 0) < orders.totalPrice',
          );
          break;

        default:
          queryBuilder.andWhere('orders.paymentStatus = :paymentStatus', {
            paymentStatus: filterOptions.paymentStatus,
          });
      }
    }

    queryBuilder.orderBy(`orders.${sortBy}`, sortOrder).skip(skip).take(limit);

    const [orders, total] = await queryBuilder.getManyAndCount();
    const statusIds = [...new Set(orders.map((order) => order.statusId))];
    const statuses = await this.statusRepository.findBy({
      value: In(statusIds),
    });
    const deliveryPartnerIds = [
      ...new Set(orders.map((order) => order.currier)),
    ];
    const deliveryPartner = await this.deliveryPartnerRepository.findBy({
      id: In(deliveryPartnerIds),
    });
    const currierMap = new Map(
      deliveryPartner.map(({ secret_key, api_key, ...partner }) => [
        partner.id,
        partner,
      ]),
    );
    const customerIds = [...new Set(orders.map((order) => order.customerId))];
    const customers = await this.customerRepository.findBy({
      customer_Id: In(customerIds),
    });

    const agentIds = [...new Set(orders.map((order) => order.agentId))];
    const agents = await this.usersRepository.findBy({
      userId: In(agentIds),
    });

    const orderIds = orders.map((order) => order.id);
    const ordersWithReturns = orderIds.length
      ? await this.orderProductReturnRepository
          .createQueryBuilder('opr')
          .select('DISTINCT opr.orderId', 'orderId')
          .where('opr.orderId IN (:...orderIds)', { orderIds })
          .getRawMany()
      : [];
    const returnedOrderIdSet = new Set(
      ordersWithReturns.map((row) => row.orderId),
    );

    const statusMap = new Map(statuses.map((status) => [status.value, status]));
    const customerMap = new Map(
      customers.map((customer) => [customer.customer_Id, customer]),
    );
    const agentMap = new Map(agents.map((order) => [order.userId, order]));
    const modifiedData = orders.map((order) => {
      const hasReturn = returnedOrderIdSet.has(order.id);
      const totalPaid = Number(order.totalPaidAmount ?? 0);
      const totalPrice = Number(order.totalPrice ?? 0);

      const deliveryPaymentStatus = hasReturn
        ? 'PartialDelivered'
        : totalPaid >= totalPrice
          ? 'PayCollected'
          : 'PayDue';

      return {
        ...order,
        status: statusMap.get(order.statusId),
        customer: customerMap.get(order.customerId as any),
        agent: agentMap.get(order.agentId as any),
        partner: currierMap.get(order.currier as any),
        deliveryPaymentStatus,
      };
    });

    return {
      data: plainToInstance(Order, modifiedData),
      total,
      page,
      limit,
    };
  }

  // get order reports
async getOrdersReports(options, filterOptions, organizationId) {
  const { sortBy, sortOrder, limit, page, skip } =
    paginationHelpers(options);

  const queryBuilder = this.orderRepository
    .createQueryBuilder('orders')
    .where('orders.organizationId = :organizationId', {
      organizationId,
    });

  // ============================================
  // SEARCH
  // ============================================

  if (filterOptions?.searchTerm) {
    const searchTerm = `%${filterOptions.searchTerm.toString()}%`;

    queryBuilder.andWhere(
      'orders.orderNumber LIKE :searchTerm',
      {
        searchTerm,
      },
    );
  }

  // ============================================
  // DATE FIELD
  // ============================================

  const allowedDateFields = [
    'createdAt',
    'intransitTime',
    'storeTime',
    'packingTime',
    'approvedTime',
  ];

  const dateField = allowedDateFields.includes(
    filterOptions?.dateField,
  )
    ? filterOptions.dateField
    : 'createdAt';

  // ============================================
  // DATE FILTER
  // ============================================

  if (
    filterOptions?.startDate &&
    filterOptions?.endDate
  ) {
    const rawStart = String(filterOptions.startDate);
    const rawEnd = String(filterOptions.endDate);

    const parsedStart = new Date(rawStart);
    const parsedEnd = new Date(rawEnd);

    // Invalid date check
    if (
      Number.isNaN(parsedStart.getTime()) ||
      Number.isNaN(parsedEnd.getTime())
    ) {
      throw new BadRequestException(
        `Invalid date format. startDate: ${rawStart}, endDate: ${rawEnd}`,
      );
    }

    /**
     * Convert received date to Bangladesh date.
     *
     * Example:
     *
     * Sun, 30 Aug 2026 13:31:00 GMT
     *
     * Bangladesh:
     *
     * 30 Aug 2026 19:31:00
     */

    const BD_OFFSET_MS = 6 * 60 * 60 * 1000;

    const bdStart = new Date(
      parsedStart.getTime() + BD_OFFSET_MS,
    );

    const bdEnd = new Date(
      parsedEnd.getTime() + BD_OFFSET_MS,
    );

    const startYear = bdStart.getUTCFullYear();
    const startMonth = bdStart.getUTCMonth();
    const startDay = bdStart.getUTCDate();

    const endYear = bdEnd.getUTCFullYear();
    const endMonth = bdEnd.getUTCMonth();
    const endDay = bdEnd.getUTCDate();

    /**
     * Bangladesh day start
     *
     * 2026-08-30 00:00:00 BD
     *
     * => 2026-08-29 18:00:00 UTC
     */

    const utcStartDate = new Date(
      Date.UTC(
        startYear,
        startMonth,
        startDay,
        0,
        0,
        0,
        0,
      ) - BD_OFFSET_MS,
    );

    /**
     * Bangladesh day end
     *
     * 2026-08-30 23:59:59.999 BD
     *
     * => 2026-08-30 17:59:59.999 UTC
     */

    const utcEndDate = new Date(
      Date.UTC(
        endYear,
        endMonth,
        endDay,
        23,
        59,
        59,
        999,
      ) - BD_OFFSET_MS,
    );

    console.log('=================================');
    console.log('REPORT DATE FILTER');
    console.log('Raw Start:', rawStart);
    console.log('Raw End:', rawEnd);
    console.log('UTC Start:', utcStartDate.toISOString());
    console.log('UTC End:', utcEndDate.toISOString());
    console.log('Date Field:', dateField);
    console.log('=================================');

    queryBuilder.andWhere(
      `orders.${dateField} BETWEEN :startDate AND :endDate`,
      {
        startDate: utcStartDate,
        endDate: utcEndDate,
      },
    );
  }

  // ============================================
  // STATUS
  // ============================================

  let statusIdss = filterOptions?.statusId;

  if (statusIdss) {
    statusIdss = Array.isArray(statusIdss)
      ? statusIdss
      : [statusIdss];

    statusIdss = statusIdss
      .map(Number)
      .filter((id) => !Number.isNaN(id));

    if (statusIdss.length) {
      queryBuilder.andWhere(
        'orders.statusId IN (:...statusIdss)',
        {
          statusIdss,
        },
      );
    }
  }

  // ============================================
  // ORDER SOURCE
  // ============================================

  let orderSources = filterOptions?.orderSources;

  if (orderSources) {
    orderSources = Array.isArray(orderSources)
      ? orderSources
      : [orderSources];

    if (orderSources.length) {
      queryBuilder.andWhere(
        'orders.orderSource IN (:...orderSources)',
        {
          orderSources,
        },
      );
    }
  }

  // ============================================
  // AGENT
  // ============================================

  let selesAgentIds = filterOptions?.agentIds;

  if (selesAgentIds) {
    selesAgentIds = Array.isArray(selesAgentIds)
      ? selesAgentIds
      : [selesAgentIds];

    if (selesAgentIds.length) {
      queryBuilder.andWhere(
        'orders.agentId IN (:...selesAgentIds)',
        {
          selesAgentIds,
        },
      );
    }
  }

  // ============================================
  // PRODUCT
  // ============================================

  let productIds = filterOptions?.productId;

  if (productIds) {
    productIds = Array.isArray(productIds)
      ? productIds
      : [productIds];

    queryBuilder.leftJoin(
      'orders.products',
      'product',
    );

    if (productIds.length) {
      queryBuilder.andWhere(
        'product.productId IN (:...productIds)',
        {
          productIds,
        },
      );
    }
  }

  // ============================================
  // COURIER
  // ============================================

  let curierIds = filterOptions?.currier;

  if (curierIds) {
    curierIds = Array.isArray(curierIds)
      ? curierIds
      : [curierIds];

    if (curierIds.length) {
      queryBuilder.andWhere(
        'orders.currier IN (:...curierIds)',
        {
          curierIds,
        },
      );
    }
  }

  // ============================================
  // LOCATION
  // ============================================

  let locationIds = filterOptions?.locationId;

  if (locationIds) {
    locationIds = Array.isArray(locationIds)
      ? locationIds
      : [locationIds];

    if (locationIds.length) {
      queryBuilder.andWhere(
        'orders.locationId IN (:...locationIds)',
        {
          locationIds,
        },
      );
    }
  }

  // ============================================
  // PAYMENT METHOD
  // ============================================

  let paymentMethodIds =
    filterOptions?.paymentMethodIds;

  if (paymentMethodIds) {
    paymentMethodIds = Array.isArray(paymentMethodIds)
      ? paymentMethodIds
      : [paymentMethodIds];

    if (paymentMethodIds.length) {
      queryBuilder.andWhere(
        'orders.paymentMethod IN (:...paymentMethodIds)',
        {
          paymentMethodIds,
        },
      );
    }
  }

  // ============================================
  // TOTAL AMOUNT QUERY
  // ============================================

  const amountQuery = queryBuilder.clone();

  const amountResult = await amountQuery
    .select(
      'COALESCE(SUM(orders.totalPrice), 0)',
      'totalAmount',
    )
    .addSelect(
      'COALESCE(SUM(orders.totalPaidAmount), 0)',
      'totalPaidAmount',
    )
    .getRawOne();

  const totalAmount = Number(
    amountResult?.totalAmount || 0,
  );

  const totalPaidAmount = Number(
    amountResult?.totalPaidAmount || 0,
  );

  // ============================================
  // RETURN / DAMAGE QUERY
  // ============================================

  const returnQuery = queryBuilder.clone();

  const returnResult = await returnQuery
    .leftJoin(
      'orders.productReturns',
      'returnProducts',
    )
    .select(
      'COALESCE(SUM(returnProducts.returnQuantity), 0)',
      'totalReturnQty',
    )
    .addSelect(
      'COALESCE(SUM(returnProducts.damageQuantity), 0)',
      'damageQuantity',
    )
    .getRawOne();

  const totalReturnQty = Number(
    returnResult?.totalReturnQty || 0,
  );

  const damageQuantity = Number(
    returnResult?.damageQuantity || 0,
  );

  // ============================================
  // PAGINATION
  // ============================================

  queryBuilder
    .orderBy(
      `orders.${sortBy}`,
      sortOrder,
    )
    .skip(skip)
    .take(limit);

  // ============================================
  // ORDERS
  // ============================================

  const [orders, total] =
    await queryBuilder.getManyAndCount();

  // ============================================
  // STATUS IDS
  // ============================================

  const statusIds = [
    ...new Set(
      orders
        .map((order) => order.statusId)
        .filter((id) => id != null),
    ),
  ];

  // ============================================
  // WAREHOUSE IDS
  // ============================================

  const warehouseIds = [
    ...new Set(
      orders
        .map((order) => order.locationId)
        .filter((id) => id != null),
    ),
  ];

  // ============================================
  // WAREHOUSES
  // ============================================

  const warehouses =
    warehouseIds.length > 0
      ? await this.warehouseRepository.findBy({
          id: In(warehouseIds),
        })
      : [];

  // ============================================
  // STATUSES
  // ============================================

  const statuses =
    statusIds.length > 0
      ? await this.statusRepository.findBy({
          value: In(statusIds),
        })
      : [];

  // ============================================
  // DELIVERY PARTNERS
  // ============================================

  const deliveryPartnerIds = [
    ...new Set(
      orders
        .map((order) => order.currier)
        .filter((id) => id != null),
    ),
  ];

  const deliveryPartner =
    deliveryPartnerIds.length > 0
      ? await this.deliveryPartnerRepository.findBy({
          id: In(deliveryPartnerIds),
        })
      : [];

  const currierMap = new Map(
    deliveryPartner.map(
      ({
        secret_key,
        api_key,
        ...partner
      }) => [
        partner.id,
        partner,
      ],
    ),
  );

  // ============================================
  // CUSTOMERS
  // ============================================

  const customerIds = [
    ...new Set(
      orders
        .map((order) => order.customerId)
        .filter((id) => id != null),
    ),
  ];

  const customers =
    customerIds.length > 0
      ? await this.customerRepository.findBy({
          customer_Id: In(customerIds),
        })
      : [];

  // ============================================
  // AGENTS
  // ============================================

  const agentIds = [
    ...new Set(
      orders
        .map((order) => order.agentId)
        .filter((id) => id != null),
    ),
  ];

  const agents =
    agentIds.length > 0
      ? await this.usersRepository.findBy({
          userId: In(agentIds),
        })
      : [];

  // ============================================
  // MAPS
  // ============================================

  const statusMap = new Map(
    statuses.map((status) => [
      status.value,
      status,
    ]),
  );

  const customerMap = new Map(
    customers.map((customer) => [
      customer.customer_Id,
      customer,
    ]),
  );

  const warehouseMap = new Map(
    warehouses.map((warehouse) => [
      warehouse.id,
      warehouse,
    ]),
  );

  const agentMap = new Map(
    agents.map((agent) => [
      agent.userId,
      agent,
    ]),
  );

  // ============================================
  // FINAL DATA
  // ============================================

  const modifiedData = orders.map((order) => ({
    ...order,

    status: statusMap.get(
      order.statusId,
    ),

    customer: customerMap.get(
      order.customerId as any,
    ),

    agent: agentMap.get(
      order.agentId as any,
    ),

    partner: currierMap.get(
      order.currier as any,
    ),

    warehouse: warehouseMap.get(
      order.locationId as any,
    ),
  }));

  // ============================================
  // RESPONSE
  // ============================================

  return {
    data: plainToInstance(
      Order,
      modifiedData,
    ),

    total,
    page,
    limit,

    totalAmount,
    damageQuantity,
    totalReturnQty,
    totalPaidAmount,
  };
}

async getOrderById(orderId: number): Promise<Order & { partner: any }> {
  const order = await this.orderRepository.findOne({
    where: { id: orderId },
    relations: [
      'paymentHistory',
      'comments',
      'comments.user',
      'productReturns',
      'productReturns.product',
      'warehouse',
    ],
  });

  if (!order) {
    throw new NotFoundException(`Order with ID ${orderId} not found`);
  }

  if (order.comments && order.comments.length > 0) {
    order.comments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  const [products, customer] = await Promise.all([
    this.productsRepository.find({
      where: { orderId: order.id },
      relations: ['product'],
    }),
    this.customerRepository.findOne({
      where: { customer_Id: order.customerId },
    }),
  ]);

  const exchangesAsOriginal = await this.orderExchangeRepository.find({
    where: { originalOrderId: order.id },
  });

  const exchangeAsNew = await this.orderExchangeRepository.findOne({
    where: { newOrderId: order.id },
  });

  let exchangedIntoOrders: any[] = [];
  if (exchangesAsOriginal.length) {
    const newOrderIds = exchangesAsOriginal.map((e) => e.newOrderId);
    const newOrders = await this.orderRepository.find({
      where: { id: In(newOrderIds) },
    });
    const newOrderMap = new Map(newOrders.map((o) => [o.id, o]));
    exchangedIntoOrders = exchangesAsOriginal.map((e) => ({
      ...e,
      newOrder: newOrderMap.get(e.newOrderId),
    }));
  }

  let exchangedFromOrder: any = null;
  if (exchangeAsNew) {
    const originalOrder = await this.orderRepository.findOne({
      where: { id: exchangeAsNew.originalOrderId },
    });
    exchangedFromOrder = { ...exchangeAsNew, originalOrder };
  }

  return {
    ...order,
    products: products || [],
    customer,
    partner: await this.deliveryPartnerRepository.findOne({
      where: { id: order?.currier },
    }),
    exchangedIntoOrders,
    exchangedFromOrder,
  } as any;
}

  async getScanOrderById(
    orderNumber: string,
  ): Promise<Order & { partner: any }> {
    const order = await this.orderRepository.findOne({
      where: { orderNumber: orderNumber },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderNumber} not found`);
    }
    if (order.status.label !== 'Packing') {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        `Order with ID ${orderNumber} not in packing`,
      );
    }

    return order;
  }

  /**
   * Delete an order by its ID.
   */
  async deleteOrder(orderId: number): Promise<void> {
    const result = await this.orderRepository.delete(orderId);

    if (result.affected === 0) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
  }

  // =========================================================================
  // UPDATE ORDER — now wrapped in a single transaction: product diff,
  // inventory adjustments per status, product row replace, order totals
  // update and the log entry all commit/rollback together. Every inventory
  // row touched is locked first.
  // =========================================================================
async update(orderId: number, data: Order) {
  const {
    customerId,
    receiverPhoneNumber,
    products,
    discount = 0,
    shippingCharge = 0,
    agentId: actingAgentId,
    ...rest
  } = data;

  if (!products || products.length === 0) {
    throw new Error('Order must include at least one product');
  }

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  const manager = queryRunner.manager;

  try {
    const existingOrder = await manager.findOne(Order, {
      where: { id: orderId },
      relations: ['products', 'status'],
    });
    if (!existingOrder) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Order does not exist');
    }

    // FIX(3): request body sends statusId as a STRING ("2"), while
    // existingOrder.statusId / OrderStatusId enum values are NUMBERS.
    // Number(...) normalizes both sides so strict === comparisons below
    // (=== OrderStatusId.Approved etc.) actually match.
    const newStatusId = rest.statusId !== undefined && rest.statusId !== null
      ? Number(rest.statusId)
      : existingOrder.statusId;

    // also normalize what gets persisted, so the DB column doesn't end up
    // with a string where the rest of the codebase expects a number
    if (rest.statusId !== undefined) {
      rest.statusId = newStatusId;
    }

    const existingProducts = await manager.find(Products, {
      where: { orderId },
    });

    const newProductMap = new Map(products.map((p) => [p.productId, p]));
    const existingProductMap = new Map(
      existingProducts.map((p) => [p.productId, p]),
    );
    const allProductIds = new Set([
      ...newProductMap.keys(),
      ...existingProductMap.keys(),
    ]);

    const validatedProducts: any[] = [];
    let productValue = 0;

    for (const productId of allProductIds) {
      const newItem = newProductMap.get(productId);
      const prevItem = existingProductMap.get(productId);

      const prevQuantity = prevItem ? prevItem.productQuantity : 0;
      const newQuantity = newItem ? newItem.productQuantity : 0;
      const quantityDiff = newQuantity - prevQuantity;

      const statusChanging = existingOrder.statusId !== newStatusId;

      if (quantityDiff !== 0 || statusChanging) {
        const inventory = await this.lockInventory(manager, productId);
        const inventoryItem = existingOrder.locationId
          ? await this.lockInventoryItem(
              manager,
              productId,
              existingOrder.locationId,
            )
          : null;

        if (newStatusId === OrderStatusId.Approved) {
          const wasApproved = existingOrder.statusId === OrderStatusId.Approved;
          const queDelta = wasApproved ? quantityDiff : newQuantity;

          if (queDelta !== 0) {
            if (inventory) {
              await manager.increment(
                Inventory,
                { productId },
                'orderQue',
                queDelta,
              );
            }
            if (inventoryItem) {
              await manager.increment(
                InventoryItem,
                { productId, locationId: existingOrder.locationId },
                'orderQue',
                queDelta,
              );
            }
          }
        }

        if (
          (existingOrder.statusId === OrderStatusId.Store &&
            existingOrder.status.label === 'Store') ||
          existingOrder.statusId === OrderStatusId.Packing
        ) {
          if (inventory) {
            await manager.increment(
              Inventory,
              { productId },
              'processing',
              quantityDiff,
            );
          }
          if (inventoryItem) {
            await manager.increment(
              InventoryItem,
              { productId, locationId: existingOrder.locationId },
              'processing',
              quantityDiff,
            );
          }
        }

        if (existingOrder.statusId === OrderStatusId.InTransit) {
          if (inventory) {
            await manager.decrement(
              Inventory,
              { productId },
              'stock',
              quantityDiff,
            );
          }
          if (inventoryItem) {
            await manager.decrement(
              InventoryItem,
              { productId, locationId: existingOrder.locationId },
              'quantity',
              quantityDiff,
            );
          }
        }
      }

      if (newItem) {
        const existingProduct = await manager.findOne(Product, {
          where: { id: productId },
        });
        if (!existingProduct) {
          throw new NotFoundException(
            `Product with ID ${productId} not found`,
          );
        }

        const subtotal = newItem.productQuantity * existingProduct.salePrice;
        productValue += subtotal;

        validatedProducts.push({
          orderId,
          productId,
          productQuantity: newItem.productQuantity,
          productPrice: existingProduct.salePrice,
          subtotal,
        });
      }
    }

    await manager.delete(Products, { orderId });
    if (validatedProducts.length > 0) {
      await manager.save(Products, validatedProducts);
    }

    await manager.save(OrdersLog, {
      orderId: orderId,
      agentId: actingAgentId,
      action: `Order updated. Products and other information (e.g., shipping charge, customer details) have been modified.`,
      previousValue: existingOrder ? JSON.stringify(existingOrder) : null,
      newValue: JSON.stringify(data),
    });

    const grandTotal =
      productValue + Number(shippingCharge) - Number(discount);
    const effectiveTotalPaidAmount =
      rest.totalPaidAmount !== undefined && rest.totalPaidAmount !== null
        ? Number(rest.totalPaidAmount)
        : Number(existingOrder.totalPaidAmount) || 0;
    const totalReceivableAmount = grandTotal - effectiveTotalPaidAmount;

    await manager.update(
      Order,
      { id: orderId },
      {
        ...rest,
        customerId,
        receiverPhoneNumber,
        discount,
        shippingCharge,
        totalPrice: grandTotal,
        productValue,
        totalReceiveAbleAmount: totalReceivableAmount,
      },
    );

    const updated = await manager.findOne(Order, {
      where: { id: orderId },
      relations: ['products'],
    });

    await queryRunner.commitTransaction();
    return updated;
  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    if (
      error instanceof ApiError ||
      error instanceof NotFoundException ||
      error instanceof BadRequestException
    ) {
      throw error;
    }
    throw new ApiError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to update order',
    );
  } finally {
    await queryRunner.release();
  }
}
  // =========================================================================
  // ADD PAYMENT — payment insert + order totals recompute + log now atomic,
  // and the order row is locked so two simultaneous payments on the same
  // order can't both compute totals from the same stale totalPaidAmount.
  // =========================================================================
  async addPayment(orderId: number, data: PaymentHistory) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const manager = queryRunner.manager;

    try {
      const isOrderExist = await manager
        .createQueryBuilder(Order, 'order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId })
        .getOne();
      if (!isOrderExist) {
        throw new ApiError(HttpStatus.BAD_REQUEST, 'Order is not exist ');
      }

      const previousHistory = await manager.find(PaymentHistory, {
        where: { orderId: orderId },
      });

      const insertPayment = await manager.save(PaymentHistory, data);
      if (!insertPayment) {
        throw new ApiError(HttpStatus.BAD_REQUEST, 'Payment is not added ');
      }

      const totalPaidAmount = [...previousHistory, data].reduce(
        (total, payment) => total + Number(payment.paidAmount),
        0,
      );
      const grandTotal =
        Number(isOrderExist.productValue) +
        Number(isOrderExist.shippingCharge) -
        Number(isOrderExist.discount);
      const totalReceivableAmount = grandTotal - totalPaidAmount;

      await manager.update(
        Order,
        { id: orderId },
        {
          totalPaidAmount,
          totalReceiveAbleAmount: totalReceivableAmount,
          paymentStatus: data?.paymentStatus,
        },
      );

      await manager.save(OrdersLog, {
        orderId: orderId,
        agentId: data.userId,
        action: `A payment with status '${data.paymentStatus}' was added using the '${data.paymentMethod}' method.`,
        previousValue:
          previousHistory?.length > 0
            ? JSON.stringify(previousHistory[0])
            : null,
        newValue: JSON.stringify(data),
      });

      const updated = await manager.findOne(Order, { where: { id: orderId } });
      await queryRunner.commitTransaction();
      return updated;
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to add payment',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async changeStatusBulk(
    orderIds: number[],
    mainData: any,
    organizationId: string,
  ) {
    const MAX_CHUNK = 100; // 100 orders per batch
    const chunkedOrders = _.chunk(orderIds, MAX_CHUNK);
    let finalUpdatedOrders: any[] = [];

    for (const chunk of chunkedOrders) {
      const updatedOrders = await this.processOrdersChunk(
        chunk,
        mainData,
        organizationId,
      );
      finalUpdatedOrders = finalUpdatedOrders.concat(updatedOrders);
    }

    return finalUpdatedOrders;
  }

  // ===============================
  // ✅ Process Single Chunk of Orders
  // FIX: every inventory read is now locked via queryRunner.manager, every
  // write goes through queryRunner.manager (not the injected repositories),
  // and the requisition/timestamp updates for statusId 5/6 were moved OUT of
  // the per-product loop (they used to fire once per product line, and used
  // the non-transactional repository).
  // ===============================
  private async processOrdersChunk(
  orderIds: number[],
  mainData: any,
  organizationId: string,
) {
  const { currentStatus, agentId: actingAgentId, ...data } = mainData;

  const orders = await this.orderRepository.find({
    where: { id: In(orderIds) },
    relations: ['status'],
  });

  if (orders.length !== orderIds.length) {
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      'Some orders do not exist',
    );
  }

  const queryRunner = this.dataSource.createQueryRunner();

  await queryRunner.connect();
  await queryRunner.startTransaction();

  const manager = queryRunner.manager;

  try {
    const allProducts = await manager.find(Products, {
      where: { orderId: In(orderIds) },
    });

    for (const product of allProducts) {
      const { productId, productQuantity } = product;

      const order = orders.find((o) => o.id === product.orderId);

      if (!order) continue;

      const qty = Number(productQuantity) || 0;

      if (qty <= 0) {
        continue;
      }

      const inventory = await this.lockInventory(
        manager,
        productId,
      );

      const inventoryItem = order.locationId
        ? await this.lockInventoryItem(
            manager,
            productId,
            order.locationId,
          )
        : null;

      // ============================================================
      // STATUS 7: IN-TRANSIT
      //
      // Packing/Processing -> In-transit
      //
      // Inventory:
      // processing -= qty
      // stock      -= qty
      // ============================================================

      if (data.statusId === OrderStatusId.InTransit) {
        if (inventory) {
          await manager.decrement(
            Inventory,
            { productId },
            'processing',
            qty,
          );

          await manager.decrement(
            Inventory,
            { productId },
            'stock',
            qty,
          );
        }

        if (inventoryItem) {
          await manager.decrement(
            InventoryItem,
            {
              productId,
              locationId: order.locationId,
            },
            'processing',
            qty,
          );

          await manager.decrement(
            InventoryItem,
            {
              productId,
              locationId: order.locationId,
            },
            'quantity',
            qty,
          );
        }
      }

      // ============================================================
      // STATUS 4: CANCEL
      //
      // Store/Packing -> Cancel
      //
      // Inventory:
      // processing -= qty
      // ============================================================

      if (
        data.statusId === OrderStatusId.Cancel &&
        (
          currentStatus === OrderStatusId.Store ||
          currentStatus === OrderStatusId.Packing
        )
      ) {
        if (inventory) {
          await manager.decrement(
            Inventory,
            { productId },
            'processing',
            qty,
          );
        }

        if (inventoryItem) {
          await manager.decrement(
            InventoryItem,
            {
              productId,
              locationId: order.locationId,
            },
            'processing',
            qty,
          );
        }
      }

      // ============================================================
      // STATUS 4: CANCEL
      //
      // Approved -> Cancel
      //
      // Inventory:
      // orderQue -= qty
      // ============================================================

      if (
        data.statusId === OrderStatusId.Cancel &&
        currentStatus === OrderStatusId.Approved
      ) {
        if (inventory) {
          await manager.decrement(
            Inventory,
            { productId },
            'orderQue',
            qty,
          );
        }

        if (inventoryItem) {
          await manager.decrement(
            InventoryItem,
            {
              productId,
              locationId: order.locationId,
            },
            'orderQue',
            qty,
          );
        }
      }

      // ============================================================
      // STATUS 4: CANCEL
      //
      // Hold -> Cancel
      //
      // Inventory:
      // hoildQue -= qty
      // ============================================================

      if (
        data.statusId === OrderStatusId.Cancel &&
        currentStatus === OrderStatusId.Hold
      ) {
        if (inventory) {
          await manager.decrement(
            Inventory,
            { productId },
            'hoildQue',
            qty,
          );
        }

        if (inventoryItem) {
          await manager.decrement(
            InventoryItem,
            {
              productId,
              locationId: order.locationId,
            },
            'hoildQue',
            qty,
          );
        }
      }

      // ============================================================
      // STATUS 3: HOLD
      //
      // Approved -> Hold
      //
      // Inventory:
      // orderQue -= qty
      // hoildQue += qty
      //
      // Packing -> Hold
      //
      // Inventory:
      // processing -= qty
      // hoildQue += qty
      // ============================================================

      if (
        data.statusId === OrderStatusId.Hold &&
        (
          currentStatus === OrderStatusId.Approved ||
          currentStatus === OrderStatusId.Packing
        )
      ) {
        if (inventory) {
          if (currentStatus === OrderStatusId.Approved) {
            // Approved -> Hold
            await manager.query(
              `
              UPDATE "inventory"
              SET
                "orderQue" = COALESCE("orderQue", 0) - $1,
                "hoildQue" = COALESCE("hoildQue", 0) + $1,
                "updatedAt" = NOW()
              WHERE "productId" = $2
              `,
              [qty, productId],
            );
          }

          if (currentStatus === OrderStatusId.Packing) {
            // Packing -> Hold
            await manager.query(
              `
              UPDATE "inventory"
              SET
                "processing" = COALESCE("processing", 0) - $1,
                "hoildQue" = COALESCE("hoildQue", 0) + $1,
                "updatedAt" = NOW()
              WHERE "productId" = $2
              `,
              [qty, productId],
            );
          }
        }

        if (inventoryItem) {
          if (currentStatus === OrderStatusId.Approved) {
            // Approved -> Hold
            await manager.query(
              `
              UPDATE "inventoryItems"
              SET
                "orderQue" = COALESCE("orderQue", 0) - $1,
                "hoildQue" = COALESCE("hoildQue", 0) + $1,
                "updatedAt" = NOW()
              WHERE "productId" = $2
                AND "locationId" = $3
              `,
              [
                qty,
                productId,
                order.locationId,
              ],
            );
          }

          if (currentStatus === OrderStatusId.Packing) {
            // Packing -> Hold
            await manager.query(
              `
              UPDATE "inventoryItems"
              SET
                "processing" = COALESCE("processing", 0) - $1,
                "hoildQue" = COALESCE("hoildQue", 0) + $1,
                "updatedAt" = NOW()
              WHERE "productId" = $2
                AND "locationId" = $3
              `,
              [
                qty,
                productId,
                order.locationId,
              ],
            );
          }
        }
      }

      // ============================================================
      // STATUS 2: APPROVED
      //
      // Pending/Cancel -> Approved
      //
      // Inventory:
      // orderQue += qty
      // ============================================================

      if (
        data.statusId === OrderStatusId.Approved &&
        (
          currentStatus === OrderStatusId.Pending ||
          currentStatus === OrderStatusId.Cancel
        )
      ) {
        if (inventory) {
          await manager.increment(
            Inventory,
            { productId },
            'orderQue',
            qty,
          );
        }

        if (inventoryItem) {
          await manager.increment(
            InventoryItem,
            {
              productId,
              locationId: order.locationId,
            },
            'orderQue',
            qty,
          );
        } else if (inventory && order.locationId) {
          await this.ensureInventoryItem(
            manager,
            productId,
            order.locationId,
            inventory.id,
          );

          await manager.increment(
            InventoryItem,
            {
              productId,
              locationId: order.locationId,
            },
            'orderQue',
            qty,
          );
        }
      }

      // ============================================================
      // STATUS 3: HOLD
      //
      // Pending -> Hold
      //
      // Inventory:
      // hoildQue += qty
      // ============================================================

      if (
        data.statusId === OrderStatusId.Hold &&
        currentStatus === OrderStatusId.Pending
      ) {
        if (inventory) {
          await manager.increment(
            Inventory,
            { productId },
            'hoildQue',
            qty,
          );
        }

        if (inventoryItem) {
          await manager.increment(
            InventoryItem,
            {
              productId,
              locationId: order.locationId,
            },
            'hoildQue',
            qty,
          );
        } else if (inventory && order.locationId) {
          await this.ensureInventoryItem(
            manager,
            productId,
            order.locationId,
            inventory.id,
          );

          await manager.increment(
            InventoryItem,
            {
              productId,
              locationId: order.locationId,
            },
            'hoildQue',
            qty,
          );
        }
      }
    }

    // ============================================================
    // STATUS 9 / 11 / 13
    //
    // Unreachable / Pending-Return / Damage
    //
    // No inventory transition currently defined.
    // ============================================================

    if (
      data.statusId === OrderStatusId.Unreachable ||
      data.statusId === OrderStatusId.PendingReturn ||
      data.statusId === OrderStatusId.Damage
    ) {
      this.logger.warn(
        `Order(s) [${orderIds.join(', ')}] moved to statusId ${
          data.statusId
        } (${OrderStatusId[data.statusId]}) — NO inventory transition ` +
        `is implemented for this status yet. orderQue/hoildQue/processing/stock ` +
        `were left untouched. Confirm the intended business rule and implement it.`,
      );
    }

    // ============================================================
    // STATUS 5: STORE
    // ============================================================

    if (data.statusId === OrderStatusId.Store) {
      await this.requisitionService.createRequisition(
        {
          orderIds,
          userId: data?.userId ?? data?.agentId,
        },
        organizationId,
      );

      await manager.update(
        Order,
        { id: In(orderIds) },
        {
          storeTime: new Date(),
        },
      );
    }

    // ============================================================
    // STATUS 6: PACKING
    // ============================================================

    if (data.statusId === OrderStatusId.Packing) {
      await manager.update(
        Order,
        { id: In(orderIds) },
        {
          packingTime: new Date(),
        },
      );
    }

    // ============================================================
    // STATUS 7: IN-TRANSIT TIMESTAMP
    // ============================================================

    if (data.statusId === OrderStatusId.InTransit) {
      await manager.update(
        Order,
        { id: In(orderIds) },
        {
          intransitTime: new Date(),
        },
      );
    }

    // ============================================================
    // UPDATE ORDER STATUS
    // ============================================================

    await manager.update(
      Order,
      { id: In(orderIds) },
      {
        ...data,
        previousStatus:
          currentStatus !== undefined &&
          currentStatus !== null
            ? String(currentStatus)
            : (null as unknown as string),
      },
    );

    // ============================================================
    // COMMIT TRANSACTION
    // ============================================================

    await queryRunner.commitTransaction();
  } catch (error: any) {
    await queryRunner.rollbackTransaction();

    throw new ApiError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to update inventory',
    );
  } finally {
    await queryRunner.release();
  }

  // ================================================================
  // COURIER API
  // ================================================================

  if (data.statusId === OrderStatusId.InTransit) {
    const ordersByCourierPartnerId = new Map<
      string,
      typeof orders
    >();

    for (const op of orders) {
      const key = op.currier || 'unassigned';

      if (!ordersByCourierPartnerId.has(key)) {
        ordersByCourierPartnerId.set(key, []);
      }

      ordersByCourierPartnerId.get(key)!.push(op);
    }

    for (
      const [partnerId, partnerOrders] of
      ordersByCourierPartnerId
    ) {
      if (partnerId === 'unassigned') {
        this.logger.warn(
          `Skipped ${partnerOrders.length} order(s) with no courier partner assigned: ` +
          `[${partnerOrders
            .map((o) => o.invoiceNumber)
            .join(', ')}]`,
        );

        continue;
      }

      const currierCompany =
        await this.deliveryPartnerRepository.findOne({
          where: {
            organizationId,
            id: partnerId,
          },
        });

      if (!currierCompany) {
        this.logger.warn(
          `Courier partner ${partnerId} not found for org ${organizationId}, ` +
          `skipping ${partnerOrders.length} order(s): [` +
          `${partnerOrders
            .map((o) => o.invoiceNumber)
            .join(', ')}]`,
        );

        continue;
      }

      if (currierCompany.partnerName === 'SteadFast') {
        await this.sendOrdersToSteadfast(
          partnerOrders,
          currierCompany,
          currentStatus,
        );
      }
    }
  }

  // ================================================================
  // SAVE ORDER LOGS
  // ================================================================

  const updatedOrders = await this.orderRepository.find({
    where: {
      id: In(orderIds),
    },
    relations: ['status'],
  });

  const orderLogs = orders.map((order) => {
    const updatedOrder = updatedOrders.find(
      (item) => item.id === order.id,
    );

    return {
      orderId: order.id,
      agentId: actingAgentId,
      action: `Order Status changed to ${
        updatedOrder?.status?.label
      } from ${order.status.label}`,
      previousValue: null,
    };
  });

  await this.orderLogsRepository.save(orderLogs);

  return updatedOrders;
}

  // ---------- Reconcile a batch of orders whose Steadfast outcome is uncertain ----------
  // FIX: single 2s retry ছিল — Steadfast async ভাবে order create করে, তাই ছোট
  // window-এ 404 পাওয়া মানেই "genuinely failed" না। এখন backoff দিয়ে কয়েকবার
  // check করা হচ্ছে আগে confirmedFailed ধরার আগে। যদি সব attempt শেষেও কোনো
  // পক্ষে নিশ্চিত না হওয়া যায়, order-টা confirmedFailed-এ যায় না — untouched
  // থাকে, আর reconcileRevertedCourierOrders() cron পরে আবার চেষ্টা করবে।
  private async reconcileWithSteadfast(
    orders: Order[],
    currierCompany: any,
  ): Promise<{ confirmedInCourier: Map<number, any>; confirmedFailed: Order[] }> {
    const confirmedInCourier = new Map<number, any>();
    const confirmedFailed: Order[] = [];
    const RETRY_DELAYS_MS = [2000, 5000, 15000]; // মোট ~22s spread

    const checkOnce = async (invoiceNumber: string) => {
      const res = await axios.get(
        `https://portal.packzy.com/api/v1/status_by_invoice/${encodeURIComponent(invoiceNumber)}`,
        {
          headers: {
            'Api-Key': currierCompany.api_key,
            'Secret-Key': currierCompany.secret_key,
          },
          timeout: 15000,
        },
      );
      const data = res.data;
      const exists =
        data?.status === 200 && (data?.delivery_status || data?.consignment_id);
      return { exists, data };
    };

    for (const op of orders) {
      let resolved = false;

      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
        }

        try {
          const { exists, data } = await checkOnce(op.invoiceNumber);
          if (exists) {
            confirmedInCourier.set(op.id, data);
          } else {
            confirmedFailed.push(op);
          }
          resolved = true;
          break;
        } catch (err: any) {
          if (err?.response?.status === 404) {
            // 404 মানেও এখনই "নাই" ধরছি না — Steadfast async, পরের attempt-এ try করো
            continue;
          }
          // network/timeout error — পরের attempt-এ try করো
          continue;
        }
      }

      if (!resolved) {
        this.logger.error(
          `UNRESOLVED: could not confirm Steadfast state for invoice ${op.invoiceNumber} after ${RETRY_DELAYS_MS.length + 1} attempts — leaving order ${op.id} untouched. Needs cron reconciliation.`,
        );
        // NOTE: resolved=false মানে এই order confirmedFailed-এও যাচ্ছে না, তাই
        // status Packing-এ ভুলভাবে revert হবে না। reconcileRevertedCourierOrders()
        // পরে আবার চেক করে সিদ্ধান্ত নেবে।
      }
    }

    return { confirmedInCourier, confirmedFailed };
  }

  // ---------- Revert an order's status/inventory — ONLY for CONFIRMED failures ----------
  // FIX: wrapped inventory reads in the SAME transaction with locks (was
  // already using queryRunner here, but reads used plain `manager.increment`
  // without a preceding lock — increment itself is atomic so that part was
  // fine; the real fix here is defensive validation of revertToStatusId,
  // which was already present, kept as-is).
  private async revertFailedCourierOrders(
    failedOrders: Order[],
    revertToStatusId: number,
    reason: {
      courierStatus: string;
      courierNotificationType: string;
      trackingMessage: string;
    },
  ): Promise<void> {
    if (!failedOrders.length) return;

    if (
      revertToStatusId === undefined ||
      revertToStatusId === null ||
      isNaN(revertToStatusId)
    ) {
      this.logger.error(
        `CRITICAL: cannot revert courier-failed orders [${failedOrders
          .map((o) => o.invoiceNumber)
          .join(', ')}] — no valid revertToStatusId was provided (got: ${revertToStatusId}). Order(s) remain incorrectly at statusId 7.`,
      );
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const orderIds = failedOrders.map((o) => o.id);
      const products = await queryRunner.manager.find(Products, {
        where: { orderId: In(orderIds) },
      });

      for (const order of failedOrders) {
        const orderProducts = products.filter((p) => p.orderId === order.id);

        for (const product of orderProducts) {
          const { productId, productQuantity } = product;

          await queryRunner.manager.increment(
            Inventory,
            { productId },
            'processing',
            productQuantity,
          );
          await queryRunner.manager.increment(
            Inventory,
            { productId },
            'stock',
            productQuantity,
          );

          if (order.locationId) {
            await queryRunner.manager.increment(
              InventoryItem,
              { productId, locationId: order.locationId },
              'processing',
              productQuantity,
            );
            await queryRunner.manager.increment(
              InventoryItem,
              { productId, locationId: order.locationId },
              'quantity',
              productQuantity,
            );
          }
        }

        await queryRunner.manager.update(
          Order,
          { id: order.id },
          {
            statusId: revertToStatusId,
            // `previousStatus` is typed as `string` on the entity; cast the
            // intentional null clear-out so it satisfies that type without
            // changing the value written.
            previousStatus: null as unknown as string,
            intransitTime: null,
            courierStatus: reason.courierStatus,
            courierNotificationType: reason.courierNotificationType,
            trackingMessage: reason.trackingMessage,
            courierUpdatedAt: new Date(),
          },
        );

        await queryRunner.manager.save(OrdersLog, {
          orderId: order.id,
          agentId: null,
          action: `Courier dispatch confirmed failed (${reason.courierNotificationType}: ${reason.trackingMessage}). Status reverted from In-Transit to ${revertToStatusId}, inventory restored.`,
          previousValue: null,
        });
      }

      await queryRunner.commitTransaction();
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `CRITICAL: failed to revert courier-failed orders [${failedOrders
          .map((o) => o.invoiceNumber)
          .join(', ')}] to statusId ${revertToStatusId} — they remain incorrectly at statusId 7: ${err.message}`,
        err.stack,
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async confirmCourierSuccess(
    confirmedInCourier: Map<number, any>,
  ): Promise<void> {
    const updates: Promise<any>[] = [];
    for (const [orderId, data] of confirmedInCourier) {
      updates.push(
        this.orderRepository.update(orderId, {
          consignmentId: data.consignment_id ? String(data.consignment_id) : null,
          trackingCode: data.tracking_code || null,
          courierStatus: data.delivery_status || 'in_review',
          courierNotificationType: 'order_created',
          courierUpdatedAt: new Date(),
        }),
      );
    }
    await Promise.all(updates);
  }

  private async sendOrdersToSteadfast(
    orders: any[],
    currierCompany: any,
    revertToStatusId: number,
  ): Promise<void> {
    const normalizeBdPhone = (raw: string): string | null => {
      if (!raw) return null;
      let digits = raw.replace(/\D/g, '');
      if (digits.startsWith('00')) digits = digits.slice(2);
      if (digits.startsWith('880')) digits = digits.slice(3);
      if (digits.length === 10 && !digits.startsWith('0')) digits = '0' + digits;
      return /^0[0-9]{10}$/.test(digits) ? digits : null;
    };

    const ordersWithPhone = orders.map((op) => ({
      op,
      normalizedPhone: normalizeBdPhone(op.receiverPhoneNumber),
    }));

    const validOrders = ordersWithPhone
      .filter((x) => x.normalizedPhone !== null)
      .map((x) => x.op);
    const invalidOrders = ordersWithPhone
      .filter((x) => x.normalizedPhone === null)
      .map((x) => x.op);

    const normalizedPhoneByOrderId = new Map<number, string>();
    for (const x of ordersWithPhone) {
      if (x.normalizedPhone) normalizedPhoneByOrderId.set(x.op.id, x.normalizedPhone);
    }

    if (invalidOrders.length) {
      await this.revertFailedCourierOrders(invalidOrders, revertToStatusId, {
        courierStatus: 'error',
        courierNotificationType: 'invalid_phone',
        trackingMessage:
          'Recipient phone number is not a valid 11-digit BD number — not sent to courier',
      });
      this.logger.warn(
        `Reverted ${invalidOrders.length} order(s) with invalid phone number for Steadfast: [${invalidOrders
          .map((o) => o.invoiceNumber)
          .join(', ')}]`,
      );
    }

    if (!validOrders.length) return;

    const courierPayload = validOrders.map((op) => ({
      invoice: op.invoiceNumber,
      recipient_name: op.receiverName,
      recipient_phone: normalizedPhoneByOrderId.get(op.id) || op.receiverPhoneNumber,
      recipient_address: op.receiverAddress,
      cod_amount: op.totalReceiveAbleAmount,
      note: op.deliveryNote || 'N/A',
    }));

    let steadfastResults: any[] = [];

    try {
      const response = await axios.post(
        'https://portal.packzy.com/api/v1/create_order/bulk-order',
        courierPayload,
        {
          headers: {
            'Api-Key': currierCompany.api_key,
            'Secret-Key': currierCompany.secret_key,
          },
          timeout: 30000,
        },
      );

      steadfastResults = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      this.logger.log(
        `Steadfast bulk order request sent: ${validOrders.length} order(s), invoices [${validOrders
          .map((o) => o.invoiceNumber)
          .join(', ')}], ${steadfastResults.length} result(s) received`,
      );
    } catch (err: any) {
      const errMsg = err?.response?.data ? JSON.stringify(err.response.data) : err.message;
      this.logger.error(
        `Steadfast bulk order request failed for invoices [${validOrders
          .map((o) => o.invoiceNumber)
          .join(', ')}]: ${errMsg}`,
      );

      const { confirmedInCourier, confirmedFailed } =
        await this.reconcileWithSteadfast(validOrders, currierCompany);

      if (confirmedInCourier.size) {
        await this.confirmCourierSuccess(confirmedInCourier);
        this.logger.log(
          `Reconciled ${confirmedInCourier.size} order(s) as ALREADY IN COURIER despite request error: [${[
            ...confirmedInCourier.keys(),
          ].join(', ')}]`,
        );
      }

      if (confirmedFailed.length) {
        await this.revertFailedCourierOrders(confirmedFailed, revertToStatusId, {
          courierStatus: 'error',
          courierNotificationType: 'courier_request_failed',
          trackingMessage: `Steadfast bulk request failed and reconciliation confirmed non-delivery: ${errMsg}`,
        });
      }

      return;
    }

    if (!steadfastResults.length) {
      this.logger.warn(
        `Steadfast returned no results for invoices [${validOrders.map((o) => o.invoiceNumber).join(', ')}]`,
      );
      const { confirmedInCourier, confirmedFailed } =
        await this.reconcileWithSteadfast(validOrders, currierCompany);

      if (confirmedInCourier.size) await this.confirmCourierSuccess(confirmedInCourier);
      if (confirmedFailed.length) {
        await this.revertFailedCourierOrders(confirmedFailed, revertToStatusId, {
          courierStatus: 'error',
          courierNotificationType: 'empty_courier_response',
          trackingMessage: 'Steadfast returned an empty result set; reconciliation confirmed non-delivery',
        });
      }
      return;
    }

    const resultsByInvoice = new Map<string, any>();
    for (const result of steadfastResults) {
      if (result?.invoice) resultsByInvoice.set(String(result.invoice), result);
    }

    const succeededUpdates: Promise<any>[] = [];
    const noResultOrders: Order[] = [];
    const duplicateOrders: Order[] = [];
    const genuineFailedOrders: Order[] = [];
    const failedReasons = new Map<number, string>();

    for (const op of validOrders) {
      const result = resultsByInvoice.get(String(op.invoiceNumber));

      if (!result) {
        noResultOrders.push(op);
        continue;
      }

      if (result.status === 'success') {
        succeededUpdates.push(
          this.orderRepository.update(op.id, {
            consignmentId: result.consignment_id ? String(result.consignment_id) : null,
            trackingCode: result.tracking_code || null,
            courierStatus: 'in_review',
            courierNotificationType: 'order_created',
            codAmount: op.totalReceiveAbleAmount,
            courierUpdatedAt: new Date(),
          }),
        );
        continue;
      }

      const errStr = Array.isArray(result?.error)
        ? result.error.join(',')
        : String(result?.error || '');

      if (errStr.includes('THIS_INVOICE_ALREADY_EXISTS')) {
        duplicateOrders.push(op);
      } else {
        genuineFailedOrders.push(op);
        failedReasons.set(op.id, result?.message || errStr || 'Steadfast order creation failed');
      }

      this.logger.warn(
        `Steadfast order creation not successful for invoice ${op.invoiceNumber}: ${JSON.stringify(result)}`,
      );
    }

    await Promise.all(succeededUpdates);

    const toReconcile = [...noResultOrders, ...duplicateOrders];
    if (toReconcile.length) {
      const { confirmedInCourier, confirmedFailed } =
        await this.reconcileWithSteadfast(toReconcile, currierCompany);

      if (confirmedInCourier.size) {
        await this.confirmCourierSuccess(confirmedInCourier);
        this.logger.log(
          `Reconciled ${confirmedInCourier.size} order(s) as ALREADY IN COURIER (duplicate/no-result case): [${[
            ...confirmedInCourier.keys(),
          ].join(', ')}]`,
        );
      }

      if (confirmedFailed.length) {
        await this.revertFailedCourierOrders(confirmedFailed, revertToStatusId, {
          courierStatus: 'error',
          courierNotificationType: 'reconciled_not_found',
          trackingMessage:
            'Reconciliation via status_by_invoice confirmed this order was never created at Steadfast',
        });
      }
    }

    if (genuineFailedOrders.length) {
      for (const op of genuineFailedOrders) {
        await this.revertFailedCourierOrders([op], revertToStatusId, {
          courierStatus: 'error',
          courierNotificationType: 'order_create_failed',
          trackingMessage: failedReasons.get(op.id) || 'Steadfast order creation failed',
        });
      }
    }
  }

  // =========================================================================
  // SAFETY-NET RECONCILIATION — cron/scheduler দিয়ে প্রতি ১০-১৫ মিনিটে চালাও।
  // যেসব order আগে "courier failed" ধরে Packing/আগের status-এ revert হয়ে
  // গিয়েছিল, তাদের আবার Steadfast-এ status_by_invoice দিয়ে চেক করে — যদি
  // আসলে ওখানে exist করে, status In-Transit-এ ফিরিয়ে আনে আর ভুলভাবে restore
  // হওয়া inventory আবার deduct করে দেয়।
  //
  // ব্যবহার: এই মেথডকে একটা @Cron() job থেকে প্রতিটা org-এর জন্য কল করো, বা
  // ইতিমধ্যে affected order গুলো fix করতে একবার বড় lookbackHours দিয়ে
  // ম্যানুয়ালি কল করো (যেমন 24*30 = গত এক মাস)।
  // =========================================================================
  async reconcileRevertedCourierOrders(
    organizationId: string,
    lookbackHours = 48,
  ): Promise<{ corrected: number; stillFailed: number }> {
    const FAILURE_MARKERS = [
      'courier_request_failed',
      'empty_courier_response',
      'reconciled_not_found',
      'order_create_failed',
    ];

    const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

    const candidates = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.organizationId = :organizationId', { organizationId })
      .andWhere('o.courierNotificationType IN (:...markers)', {
        markers: FAILURE_MARKERS,
      })
      .andWhere('o.courierUpdatedAt >= :since', { since })
      .andWhere('o.consignmentId IS NULL')
      .getMany();

    if (!candidates.length) return { corrected: 0, stillFailed: 0 };

    const byPartner = new Map<string, Order[]>();
    for (const o of candidates) {
      const key = o.currier || 'unassigned';
      if (!byPartner.has(key)) byPartner.set(key, []);
      byPartner.get(key)!.push(o);
    }

    let corrected = 0;
    let stillFailed = 0;

    for (const [partnerId, partnerOrders] of byPartner) {
      if (partnerId === 'unassigned') continue;

      const currierCompany = await this.deliveryPartnerRepository.findOne({
        where: { organizationId, id: partnerId },
      });
      if (!currierCompany || currierCompany.partnerName !== 'SteadFast') continue;

      const { confirmedInCourier } = await this.reconcileWithSteadfast(
        partnerOrders,
        currierCompany,
      );

      for (const [orderId, data] of confirmedInCourier) {
        const order = partnerOrders.find((o) => o.id === orderId);
        if (!order) continue;
        await this.correctFalselyRevertedOrder(order, data);
        corrected++;
      }
      stillFailed += partnerOrders.length - confirmedInCourier.size;
    }

    return { corrected, stillFailed };
  }

  // ---------- ভুল revert undo করা: order আসলে courier-এ পাওয়া গেলে status
  // In-Transit-এ ফেরত, আর revert-এর সময় ভুলভাবে restore হওয়া inventory
  // আবার deduct করা ----------
  private async correctFalselyRevertedOrder(
    order: Order,
    courierData: any,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const manager = queryRunner.manager;

    try {
      const products = await manager.find(Products, { where: { orderId: order.id } });

      for (const product of products) {
        const { productId, productQuantity } = product;

        const inventory = await this.lockInventory(manager, productId);
        const inventoryItem = order.locationId
          ? await this.lockInventoryItem(manager, productId, order.locationId)
          : null;

        if (inventory) {
          await manager.decrement(Inventory, { productId }, 'processing', productQuantity);
          await manager.decrement(Inventory, { productId }, 'stock', productQuantity);
        }
        if (inventoryItem) {
          await manager.decrement(
            InventoryItem,
            { productId, locationId: order.locationId },
            'processing',
            productQuantity,
          );
          await manager.decrement(
            InventoryItem,
            { productId, locationId: order.locationId },
            'quantity',
            productQuantity,
          );
        }
      }

      await manager.update(
        Order,
        { id: order.id },
        {
          statusId: OrderStatusId.InTransit,
          // `previousStatus` is typed as `string` on the entity while
          // `order.statusId` is a number — convert at the write boundary
          // only, same as the other previousStatus writes in this file.
          previousStatus: String(order.statusId),
          intransitTime: order.intransitTime || new Date(),
          consignmentId: courierData.consignment_id ? String(courierData.consignment_id) : null,
          trackingCode: courierData.tracking_code || null,
          courierStatus: courierData.delivery_status || 'in_review',
          courierNotificationType: 'order_created',
          courierUpdatedAt: new Date(),
        },
      );

      await manager.save(OrdersLog, {
        orderId: order.id,
        agentId: null,
        action: `Reconciliation confirmed this order was actually created at the courier despite an earlier failure/timeout. Status corrected back to In-Transit; inventory that had been restored on revert was re-deducted.`,
        previousValue: null,
      });

      await queryRunner.commitTransaction();
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to auto-correct falsely-reverted order ${order.invoiceNumber}: ${err.message}`,
        err.stack,
      );
    } finally {
      await queryRunner.release();
    }
  }

  // ---------- Revert an order's status/inventory — ONLY for CONFIRMED failures ----------
  // =========================================================================
  // CHANGE HOLD STATUS — FIX: previously read all Inventory/InventoryItem
  // rows in bulk BEFORE the transaction started (stale snapshot), then wrote
  // computed values back inside the transaction. Two concurrent hold-status
  // changes on the same product/location would silently lose one update.
  // Now every row is locked (pessimistic_write) INSIDE the transaction right
  // before it's read+modified, and all writes use atomic increment/decrement
  // instead of "read value, add in JS, write back".
  //
  // FIX(A): `order.previousStatus` used to be compared with
  // `=== String(OrderStatusId.Approved)` / `=== String(OrderStatusId.Store)`
  // / `=== String(OrderStatusId.Packing)`, while the final status-restore
  // line a bit further down casts the SAME field numerically
  // (`+order.previousStatus`). Both treatments can't be correct for the same
  // column — in practice this meant the string-equality branches were
  // silently failing to match whenever previousStatus round-tripped as a
  // number, so hold -> process/store inventory reconciliation only ever ran
  // via the `!previousStatus` fallback branch. Normalized to a single
  // `Number(order.previousStatus)` value used everywhere below.
  //
  // FIX(B): the `manager.update(Order, ...)` that sets the order's resulting
  // statusId used to live INSIDE the per-product loop, so it fired once per
  // product line (redundant but harmless when a order had products) and
  // never fired at all for an order with zero product rows (status left
  // stuck). Moved outside the product loop so it runs exactly once per
  // order, after that order's inventory adjustments are done.
  // =========================================================================
  async changeHoldStatus(
    orderIds: number[],
    mainData: any,
    organizationId: string,
  ) {
    const { currentStatus, ...data } = mainData;

    const orders = await this.orderRepository.find({
      where: { id: In(orderIds) },
      relations: ['status'],
    });

    if (orders.length !== orderIds.length) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Some orders do not exist');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const manager = queryRunner.manager;

    try {
      const products = await manager.find(Products, {
        where: { orderId: In(orderIds) },
      });

      for (const order of orders) {
        const orderProducts = products.filter((p) => p.orderId === order.id);

        // FIX(A): normalize once per order instead of comparing the raw
        // field (of uncertain string/number shape) against `String(...)` in
        // some spots and `+...` in others.
        const previousStatusNum = order?.previousStatus
          ? Number(order.previousStatus)
          : null;

        for (const product of orderProducts) {
          // Lock right before use — no stale in-memory values.
          const inventory = await this.lockInventory(manager, product.productId);
          const inventoryItem = order.locationId
            ? await this.lockInventoryItem(
                manager,
                product.productId,
                order.locationId,
              )
            : null;

          // Previous status 2 or null, and new status is not 4
          if (
            (previousStatusNum === OrderStatusId.Approved || !previousStatusNum) &&
            data?.statusId !== 4
          ) {
            if (inventory) {
              await manager.increment(
                Inventory,
                { productId: product.productId },
                'orderQue',
                product.productQuantity,
              );
              await manager.decrement(
                Inventory,
                { productId: product.productId },
                'hoildQue',
                product.productQuantity,
              );
            }
            if (inventoryItem) {
              await manager.increment(
                InventoryItem,
                { productId: product.productId, locationId: order.locationId },
                'orderQue',
                product.productQuantity,
              );
              await manager.decrement(
                InventoryItem,
                { productId: product.productId, locationId: order.locationId },
                'hoildQue',
                product.productQuantity,
              );
            }
          }

          // Previous status 5 or 6, and new status is not 4
          if (
            (previousStatusNum === OrderStatusId.Store || previousStatusNum === OrderStatusId.Packing) &&
            data?.statusId !== 4
          ) {
            if (inventory) {
              await manager.increment(
                Inventory,
                { productId: product.productId },
                'processing',
                product.productQuantity,
              );
              await manager.decrement(
                Inventory,
                { productId: product.productId },
                'hoildQue',
                product.productQuantity,
              );
            }
            if (inventoryItem) {
              await manager.increment(
                InventoryItem,
                { productId: product.productId, locationId: order.locationId },
                'processing',
                product.productQuantity,
              );
              await manager.decrement(
                InventoryItem,
                { productId: product.productId, locationId: order.locationId },
                'hoildQue',
                product.productQuantity,
              );
            }
          }

          // New status is 4
          if (data?.statusId === OrderStatusId.Cancel) {
            if (inventory) {
              await manager.decrement(
                Inventory,
                { productId: product.productId },
                'hoildQue',
                product.productQuantity,
              );
            }
            if (inventoryItem) {
              await manager.decrement(
                InventoryItem,
                { productId: product.productId, locationId: order.locationId },
                'hoildQue',
                product.productQuantity,
              );
            }
          }
        }

        // FIX(B): runs exactly once per order now, regardless of how many
        // (or how few) product rows that order has.
        await manager.update(
          Order,
          { id: order.id },
          {
            statusId:
              data?.statusId === OrderStatusId.Cancel
                ? data?.statusId
                : previousStatusNum || 2,
          },
        );
      }

      await queryRunner.commitTransaction();
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to update inventory',
      );
    } finally {
      await queryRunner.release();
    }

    const updatedOrders = await this.orderRepository.find({
      where: { id: In(orderIds) },
      relations: ['status'],
    });

    const orderLogs = orders.map((order, index) => ({
      orderId: order.id,
      agentId: data.agentId,
      action: `Order Status changed to ${updatedOrders[index].status.label} from ${order.status.label}`,
      previousValue: null,
    }));

    await this.orderLogsRepository.save(orderLogs);

    return updatedOrders;
  }

  async getOrdersLogs(orderId: number) {
    const isExist = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!isExist) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Order is not exist');
    }
    return await this.orderLogsRepository.find({
      where: { orderId: orderId },
      relations: ['updatedBy'],
      select: {
        updatedBy: {
          name: true,
        },
      },
      order: { createdAt: 'DESC' },
    });
  }

  // =========================================================================
  // RETURN ORDERS — FIX: inventory/inventoryItem rows are now fetched with
  // pessimistic_write lock (they were previously read via plain
  // queryRunner.manager.findOne with no lock, then written back with
  // computed values — a lost-update race under concurrent returns).
  // =========================================================================
  async returnOrders(payload: {
    orderIds: string[];
    agentId: string;
    statusId: number;
    warehouse: string;
    returnableProducts: any;
    reason?: string;
  }) {
    const { orderIds, agentId, statusId, warehouse, returnableProducts, reason } =
      payload;

    const orders = await this.orderRepository.find({
      where: { id: In(orderIds) },
      relations: ['status'],
    });

    if (orders.length !== orderIds.length) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Some orders do not exist');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    const manager = queryRunner.manager;

    try {
      for (const order of orders) {
        const products = await manager.find(Products, {
          where: { orderId: order.id },
        });

        // ---- FULL RETURN ----
        if (statusId === OrderStatusId.Returned) {
          for (const product of products) {
            const inventory = await this.lockInventory(
              manager,
              product.productId,
            );
            const inventoryItem = await this.lockInventoryItem(
              manager,
              product.productId,
              warehouse,
            );

            if (inventory) {
              await manager.increment(
                Inventory,
                { productId: product.productId },
                'stock',
                product.productQuantity,
              );
            }
            if (inventoryItem) {
              await manager.increment(
                InventoryItem,
                { productId: product.productId, locationId: warehouse },
                'quantity',
                product.productQuantity,
              );
            }

            await manager.save(OrderProductReturn, {
              orderId: order.id,
              productId: product.productId,
              returnQuantity: product.productQuantity,
              damageQuantity: 0,
              reason: reason || 'Full order returned',
              remarks: `Order fully returned from ${order.status.label} status`,
              returnDate: new Date(),
            });
          }
        }

        // ---- PARTIAL RETURN ----
        if (statusId === OrderStatusId.PartialReturn) {
          for (const product of returnableProducts) {
            const inventory = await this.lockInventory(
              manager,
              product.productId,
            );
            const inventoryItem = await this.lockInventoryItem(
              manager,
              product.productId,
              warehouse,
            );

            if (inventory) {
              await manager.increment(
                Inventory,
                { productId: product.productId },
                'stock',
                product.returnQuantity,
              );
            }
            if (inventoryItem) {
              await manager.increment(
                InventoryItem,
                { productId: product.productId, locationId: warehouse },
                'quantity',
                product.returnQuantity,
              );
            }

            await manager.save(OrderProductReturn, {
              orderId: order.id,
              productId: product?.productId,
              returnQuantity: product?.returnQuantity,
              damageQuantity: product?.damageQuantity,
              reason:
                reason ||
                (product?.damageQuantity > 0
                  ? 'Customer returned; item(s) damaged'
                  : 'Customer returned'),
              remarks: `Item returned via courier on ${new Date().toISOString().split('T')[0]}`,
              returnDate: new Date(),
            });
          }
        }

        await manager.update(Order, { id: order.id }, { statusId: statusId });
      }

      const updatedOrders = await manager.find(Order, {
        where: { id: In(orderIds) },
        relations: ['status'],
      });
      const orderLogs = updatedOrders.map((updatedOrder) => {
        const originalOrder = orders.find((o) => o.id === updatedOrder.id);
        return {
          orderId: updatedOrder.id,
          agentId,
          action: `Order Status changed to ${updatedOrder.status.label} from ${originalOrder?.status.label}`,
          previousValue: null,
        };
      });

      await manager.save(OrdersLog, orderLogs);

      await queryRunner.commitTransaction();

      return updatedOrders;
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to return orders',
      );
    } finally {
      await queryRunner.release();
    }
  }

  // download excel

  async downloadOrdersExcel(
    filterOptions: any,
    organizationId: string,
    res: Response,
  ) {
    const countQb = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId });

    if (filterOptions?.searchTerm) {
      countQb.andWhere('orders.orderNumber LIKE :searchTerm', {
        searchTerm: `%${filterOptions.searchTerm}%`,
      });
    }

    if (filterOptions?.startDate && filterOptions?.endDate) {
      countQb.andWhere('orders.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(filterOptions.startDate),
        endDate: new Date(filterOptions.endDate),
      });
    }
    let curierIds = filterOptions?.currier;
    if (curierIds) {
      curierIds = Array.isArray(curierIds) ? curierIds : [curierIds];
      countQb.andWhere('orders.currier IN (:...curierIds)', {
        curierIds,
      });
    }

    let statusIdss = filterOptions?.statusId;
    if (statusIdss) {
      statusIdss = Array.isArray(statusIdss) ? statusIdss : [statusIdss];
      statusIdss = statusIdss.map(Number);
      countQb.andWhere('orders.statusId IN (:...statusIdss)', { statusIdss });
    }

    const totalOrders = await countQb.getCount();

    if (totalOrders > 100000) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        `Too many records (${totalOrders}). Please refine your filters to less than 100,000 rows.`,
      );
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=orders-report.xlsx',
    );

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useSharedStrings: false,
      useStyles: false,
    });
    const worksheet = workbook.addWorksheet('Orders Report');

    worksheet.columns = [
      { header: 'Order ID', key: 'id', width: 20 },
      { header: 'Order Number', key: 'orderNumber', width: 20 },
      { header: 'Customer ID', key: 'customerId', width: 20 },
      { header: 'Status', key: 'statusId', width: 15 },
      { header: 'Total Price', key: 'totalPrice', width: 15 },
      { header: 'Agent ID', key: 'agentId', width: 15 },
      { header: 'Created At', key: 'createdAt', width: 25 },
    ];

    const BATCH_SIZE = 5000;
    let lastId = 0;
    let hasMore = true;

    while (hasMore) {
      const qb = this.orderRepository
        .createQueryBuilder('orders')
        .where('orders.organizationId = :organizationId', { organizationId });

      if (filterOptions?.searchTerm) {
        qb.andWhere('orders.orderNumber LIKE :searchTerm', {
          searchTerm: `%${filterOptions.searchTerm}%`,
        });
      }

      if (filterOptions?.startDate && filterOptions?.endDate) {
        qb.andWhere('orders.createdAt BETWEEN :startDate AND :endDate', {
          startDate: new Date(filterOptions.startDate),
          endDate: new Date(filterOptions.endDate),
        });
      }

      if (filterOptions?.statusId) {
        let statusIds = Array.isArray(filterOptions.statusId)
          ? filterOptions.statusId
          : [filterOptions.statusId];
        statusIds = statusIds.map(Number);
        qb.andWhere('orders.statusId IN (:...statusIds)', { statusIds });
      }

      // FIX(D): the courier filter was applied to countQb (used for the
      // "too many records" guard above) but was missing here, so the
      // exported rows could silently include orders from couriers the
      // caller explicitly filtered out — and the exported row count could
      // differ from what the guard above checked. Mirror the same filter.
      let exportCurierIds = filterOptions?.currier;
      if (exportCurierIds) {
        exportCurierIds = Array.isArray(exportCurierIds)
          ? exportCurierIds
          : [exportCurierIds];
        qb.andWhere('orders.currier IN (:...exportCurierIds)', {
          exportCurierIds,
        });
      }

      if (lastId > 0) {
        qb.andWhere('orders.id > :lastId', { lastId });
      }

      qb.orderBy('orders.id', 'ASC').limit(BATCH_SIZE);

      const orders = await qb.getMany();
      if (!orders.length) {
        hasMore = false;
        break;
      }

      for (const order of orders) {
        worksheet
          .addRow({
            id: order.id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            statusId: order.statusId,
            totalPrice: order.totalPrice,
            agentId: order.agentId,
            createdAt: order.createdAt,
          })
          .commit();
        lastId = order.id;
      }
    }

    await workbook.commit();
  }

  async getProductSalesReport(options, filterOptions, organizationId) {
    const { sortBy, sortOrder, limit, skip, page } = paginationHelpers(options);

    const baseQuery = this.orderRepository
      .createQueryBuilder('orders')
      .innerJoin('orders.products', 'prod')
      .innerJoin('prod.product', 'p')
      .where('orders.organizationId = :organizationId', { organizationId });

    // Date Field Resolution
    const allowedDateFields = [
      'createdAt',
      'intransitTime',
      'storeTime',
      'packingTime',
      'approvedTime',
    ];
    const dateField = allowedDateFields.includes(filterOptions?.dateField)
      ? filterOptions.dateField
      : 'createdAt';

    // Parse Exact Date Boundaries
    let rawStartStr = filterOptions?.startDate
      ? String(filterOptions.startDate).split('T')[0]
      : '';
    let rawEndStr = filterOptions?.endDate
      ? String(filterOptions.endDate).split('T')[0]
      : '';

    if (!rawStartStr) {
      rawStartStr = new Date().toISOString().split('T')[0];
    }
    if (!rawEndStr) {
      rawEndStr = rawStartStr;
    }

    const startDate = new Date(`${rawStartStr}T00:00:00.000Z`);
    const endDate = new Date(`${rawEndStr}T23:59:59.999Z`);

    baseQuery.andWhere(`orders.${dateField} >= :startDate AND orders.${dateField} <= :endDate`, {
      startDate,
      endDate,
    });
    if (dateField !== 'createdAt') {
      baseQuery.andWhere(`orders.${dateField} IS NOT NULL`);
    }

    // Status Filter (Clean 'all' strings and empty values)
    if (filterOptions?.statusId) {
      const rawStatus = Array.isArray(filterOptions.statusId)
        ? filterOptions.statusId
        : [filterOptions.statusId];
      const cleanStatusIds = rawStatus
        .filter((s) => s !== 'all' && s !== '' && s != null)
        .map(Number)
        .filter((n) => !isNaN(n));
      if (cleanStatusIds.length > 0) {
        baseQuery.andWhere('orders.statusId IN (:...statusIds)', { statusIds: cleanStatusIds });
      }
    }

    // Warehouse / Location Filter
    if (filterOptions?.locationId) {
      const locationIds = Array.isArray(filterOptions.locationId)
        ? filterOptions.locationId
        : [filterOptions.locationId];
      const cleanLocationIds = locationIds.filter((l) => l !== 'all' && l !== '' && l != null);
      if (cleanLocationIds.length > 0) {
        baseQuery.andWhere('orders.locationId IN (:...locationIds)', { locationIds: cleanLocationIds });
      }
    }

    // Agent Filter
    if (filterOptions?.agentIds) {
      const agentIds = Array.isArray(filterOptions.agentIds)
        ? filterOptions.agentIds
        : [filterOptions.agentIds];
      const cleanAgentIds = agentIds.filter((a) => a !== 'all' && a !== '' && a != null);
      if (cleanAgentIds.length > 0) {
        baseQuery.andWhere('orders.agentId IN (:...agentIds)', { agentIds: cleanAgentIds });
      }
    }

    // Courier Filter
    if (filterOptions?.currier) {
      const curierIds = Array.isArray(filterOptions.currier)
        ? filterOptions.currier
        : [filterOptions.currier];
      const cleanCurierIds = curierIds.filter((c) => c !== 'all' && c !== '' && c != null);
      if (cleanCurierIds.length > 0) {
        baseQuery.andWhere('orders.currier IN (:...curierIds)', { curierIds: cleanCurierIds });
      }
    }

    // Product Filter
    if (filterOptions?.productId) {
      const productIds = Array.isArray(filterOptions.productId)
        ? filterOptions.productId
        : [filterOptions.productId];
      const cleanProductIds = productIds.filter((p) => p !== 'all' && p !== '' && p != null);
      if (cleanProductIds.length > 0) {
        baseQuery.andWhere('prod.productId IN (:...productIds)', { productIds: cleanProductIds });
      }
    }

    // Payment Method Filter
    let paymentMethodIds = filterOptions?.paymentMethodIds;
    if (paymentMethodIds) {
      paymentMethodIds = Array.isArray(paymentMethodIds)
        ? paymentMethodIds
        : [paymentMethodIds];
      const cleanPaymentMethods = paymentMethodIds.filter((m) => m !== 'all' && m !== '' && m != null);
      if (cleanPaymentMethods.length > 0) {
        baseQuery.andWhere('orders.paymentMethod IN (:...paymentMethodIds)', {
          paymentMethodIds: cleanPaymentMethods,
        });
      }
    }

    // Order Source Filter
    let orderSources = filterOptions?.orderSources;
    if (orderSources) {
      orderSources = Array.isArray(orderSources)
        ? orderSources
        : [orderSources];
      const cleanOrderSources = orderSources.filter((s) => s !== 'all' && s !== '' && s != null);
      if (cleanOrderSources.length > 0) {
        baseQuery.andWhere('orders.orderSource IN (:...orderSources)', {
          orderSources: cleanOrderSources,
        });
      }
    }

    // Main Aggregated Product Sales Query
    const queryBuilder = baseQuery.clone();

    queryBuilder
      .select('prod.productId', 'productId')
      .addSelect('p.name', 'productName')
      .addSelect('p.sku', 'sku')
      .addSelect('COALESCE(SUM(prod.subtotal), 0)', 'totalSaleAmount')
      .addSelect('COALESCE(SUM(prod.productQuantity), 0)', 'totalOrderQuantity')
      .addSelect('COALESCE(AVG(prod.productPrice), 0)', 'productPrice')
      .addSelect("COALESCE(orders.orderSource, 'Direct')", 'orderSource')
      .addSelect('COUNT(DISTINCT orders.id)', 'orderCount')
      .groupBy('prod.productId')
      .addGroupBy('p.name')
      .addGroupBy('p.sku')
      .addGroupBy('orders.orderSource');

    if (sortBy) {
      if (
        [
          'productName',
          'productId',
          'productPrice',
          'totalSaleAmount',
          'totalOrderQuantity',
          'orderSource',
          'orderCount',
        ].includes(sortBy)
      ) {
        queryBuilder.orderBy(sortBy, sortOrder);
      }
    } else {
      queryBuilder.orderBy('COALESCE(SUM(prod.subtotal), 0)', 'DESC');
    }

    const result = await queryBuilder.getRawMany();

    const data = result.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      sku: r.sku,
      totalSaleAmount: Number(r.totalSaleAmount || 0),
      totalOrderQuantity: Number(r.totalOrderQuantity || 0),
      price: Number(r.productPrice || 0),
      orderSource: r.orderSource,
      orderCount: Number(r.orderCount || 0),
    }));

    const countQuery = baseQuery
      .clone()
      .select('COUNT(DISTINCT prod.productId)', 'cnt');
    const totalResult = await countQuery.getRawOne();
    const total = Number(totalResult?.cnt || data.length);

    // Summary Aggregates
    const productSummaryResult = await baseQuery
      .clone()
      .select('COALESCE(SUM(prod.productQuantity), 0)', 'totalProductQuantity')
      .addSelect('COALESCE(SUM(prod.subtotal), 0)', 'totalSaleAmount')
      .addSelect('COUNT(DISTINCT orders.id)', 'totalOrders')
      .getRawOne();

    const orderRows = await baseQuery
      .clone()
      .select('orders.id', 'orderId')
      .addSelect('orders.totalPaidAmount', 'totalPaidAmount')
      .addSelect('orders.totalPrice', 'totalOrderAmount')
      .addSelect('orders.currier', 'currier')
      .groupBy('orders.id')
      .addGroupBy('orders.totalPaidAmount')
      .addGroupBy('orders.totalPrice')
      .addGroupBy('orders.currier')
      .getRawMany();

    const paidAmount = orderRows.reduce(
      (sum, order) => sum + (Number(order.totalPaidAmount) || 0),
      0,
    );
    const totalOrderAmount = orderRows.reduce(
      (sum, order) => sum + (Number(order.totalOrderAmount) || 0),
      0,
    );
    const courierOrderCount = orderRows.filter((order) => order.currier).length;

    const courierBreakdown = await baseQuery
      .clone()
      .leftJoin('orders.partner', 'dp')
      .select('orders.currier', 'courierId')
      .addSelect("COALESCE(dp.partnerName, 'Unassigned')", 'courierName')
      .addSelect('COUNT(DISTINCT orders.id)', 'orderCount')
      .addSelect('COALESCE(SUM(prod.productQuantity), 0)', 'productQuantity')
      .addSelect('COALESCE(SUM(prod.subtotal), 0)', 'saleAmount')
      .groupBy('orders.currier')
      .addGroupBy('dp.partnerName')
      .getRawMany();

    return {
      data,
      total,
      page,
      limit,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: {
        totalProducts: total,
        totalProductQuantity:
          Number(productSummaryResult?.totalProductQuantity) || 0,
        totalOrders: Number(productSummaryResult?.totalOrders) || 0,
        courierOrderCount,
        paidAmount,
        salesAmount: Number(productSummaryResult?.totalSaleAmount) || 0,
        totalOrderAmount,
        courierBreakdown: courierBreakdown.map((item) => ({
          courierId: item.courierId,
          courierName: item.courierName,
          orderCount: Number(item.orderCount) || 0,
          productQuantity: Number(item.productQuantity) || 0,
          saleAmount: Number(item.saleAmount) || 0,
        })),
      },
    };
  }

  async getDeliveryPartnerShipmentReport(
    organizationId: string,
    filterOptions: any,
  ) {
    let utcStartDate: string;
    let utcEndDate: string;

    if (filterOptions?.startDate && filterOptions?.endDate) {
      utcStartDate = new Date(filterOptions.startDate).toISOString();
      utcEndDate = new Date(
        new Date(filterOptions.endDate).getTime() + 24 * 60 * 60 * 1000 - 1,
      ).toISOString();
    } else {
      const today = new Date();
      utcStartDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0),
      ).toISOString();
      utcEndDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999),
      ).toISOString();
    }

    const ordersQb = this.orderRepository
      .createQueryBuilder('o')
      .leftJoin('o.partner', 'dp')
      .where('o.organizationId = :organizationId', { organizationId })
      .andWhere('o.intransitTime BETWEEN :startDate AND :endDate', {
        startDate: utcStartDate,
        endDate: utcEndDate,
      });

    const partnerIds = filterOptions?.currier?.length
      ? filterOptions.currier
      : null;
    if (partnerIds) {
      ordersQb.andWhere('dp.id IN (:...partnerIds)', { partnerIds });
    }

    const locationId = filterOptions?.locationId?.length
      ? filterOptions.locationId
      : null;
    if (locationId) {
      ordersQb.andWhere('o.locationId IN (:...locationId)', { locationId });
    }

    const ordersAgg = await ordersQb
      .select('dp.id', 'partnerId')
      .addSelect('dp.partnerName', 'deliveryPartner')
      .addSelect('MIN(o.intransitTime)', 'inTransitStartDate')
      .addSelect('MAX(o.intransitTime)', 'inTransitEndDate')
      .addSelect('SUM(o.shippingCharge)', 'deliveryCharge')
      .addSelect('COUNT(DISTINCT o.id)', 'orderQty')
      .addSelect('SUM(o.totalPaidAmount)', 'advancePaid')
      .groupBy('dp.id')
      .addGroupBy('dp.partnerName')
      .getRawMany();

    const prodRepo =
      this.productsRepository ??
      this.orderRepository.manager.getRepository(Products);

    const productsQb = prodRepo
      .createQueryBuilder('p')
      .leftJoin('p.order', 'o')
      .leftJoin('o.partner', 'dp')
      .where('o.organizationId = :organizationId', { organizationId })
      .andWhere('o.intransitTime BETWEEN :startDate AND :endDate', {
        startDate: utcStartDate,
        endDate: utcEndDate,
      });

    if (partnerIds) {
      productsQb.andWhere('dp.id IN (:...partnerIds)', { partnerIds });
    }

    const productsAgg = await productsQb
      .select('dp.id', 'partnerId')
      .addSelect('SUM(p.productQuantity)', 'productQty')
      .addSelect('SUM(p.productPrice)', 'productPrice')
      .addSelect('SUM(p.subtotal)', 'totalProductPrice')
      .groupBy('dp.id')
      .getRawMany();

    const paymentsQb = this.orderRepository.manager
      .getRepository(PaymentHistory)
      .createQueryBuilder('ph')
      .leftJoin('ph.order', 'o')
      .leftJoin('o.partner', 'dp')
      .where('o.organizationId = :organizationId', { organizationId })
      .andWhere('o.intransitTime BETWEEN :startDate AND :endDate', {
        startDate: utcStartDate,
        endDate: utcEndDate,
      });

    if (partnerIds) {
      paymentsQb.andWhere('dp.id IN (:...partnerIds)', { partnerIds });
    }

    const paymentsAgg = await paymentsQb
      .select('dp.id', 'partnerId')
      .addSelect('ph.paymentMethod', 'paymentMethod')
      .addSelect('SUM(ph.paidAmount)', 'paidAmount')
      .groupBy('dp.id')
      .addGroupBy('ph.paymentMethod')
      .getRawMany();

    const prodMap = new Map(productsAgg.map((r) => [String(r.partnerId), r]));

    const payMap = new Map<string, any[]>();
    for (const r of paymentsAgg) {
      if (!payMap.has(String(r.partnerId))) {
        payMap.set(String(r.partnerId), []);
      }
      payMap.get(String(r.partnerId))?.push({
        method: r.paymentMethod,
        amount: Number(r.paidAmount) || 0,
      });
    }

    const result = ordersAgg.map((r) => {
      const prod = prodMap.get(String(r.partnerId)) || {};
      const payments = payMap.get(String(r.partnerId)) || [];
      const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

      const deliveryCharge = Number(r.deliveryCharge) || 0;
      const productPrice = Number(prod.totalProductPrice) || 0;
      const total = deliveryCharge + productPrice;

      return {
        partnerId: r.partnerId,
        inTransitDate: `${r.inTransitStartDate} - ${r.inTransitEndDate}`,
        deliveryPartner: r.deliveryPartner,
        deliveryCharge,
        orderQty: Number(r.orderQty) || 0,
        productQty: Number(prod.productQty) || 0,
        productPrice: Number(prod.totalProductPrice) || 0,
        total,
        advancePaid: Number(r.advancePaid) || 0,
        payments,
        totalPaid,
        dueAmount: total - totalPaid,
      };
    });

    return result;
  }

  async getDeliveryPartnerOrderDetails(
    organizationId: string,
    partnerId: string,
    filterOptions: any,
  ) {
    let utcStartDate: string;
    let utcEndDate: string;

    if (filterOptions?.startDate && filterOptions?.endDate) {
      utcStartDate = new Date(filterOptions.startDate).toISOString();
      utcEndDate = new Date(
        new Date(filterOptions.endDate).getTime() + 24 * 60 * 60 * 1000 - 1,
      ).toISOString();
    } else {
      const today = new Date();
      utcStartDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0),
      ).toISOString();
      utcEndDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999),
      ).toISOString();
    }

    const locationId = filterOptions?.locationId?.length
      ? filterOptions.locationId
      : null;

    const qb = this.orderRepository
      .createQueryBuilder('o')
      .leftJoin('o.partner', 'dp')
      .where('o.organizationId = :organizationId', { organizationId })
      .andWhere('dp.id = :partnerId', { partnerId })
      .andWhere('o.intransitTime BETWEEN :startDate AND :endDate', {
        startDate: utcStartDate,
        endDate: utcEndDate,
      });

    if (locationId) {
      qb.andWhere('o.locationId IN (:...locationId)', { locationId });
    }

    const rows = await qb
      .select('o.intransitTime', 'inTransitDate')
      .addSelect('o.invoiceNumber', 'invoiceNumber')
      .addSelect('o.trackingCode', 'trackingId')
      .addSelect('o.receiverName', 'name')
      .addSelect('o.paymentStatus', 'paymentStatus')
      .addSelect('o.receiverPhoneNumber', 'mobileNo')
      .addSelect('COALESCE(o.codAmount, o.totalPaidAmount, 0)', 'codAmount')
      .orderBy('o.intransitTime', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      inTransitDate: r.inTransitDate,
      invoiceNumber: r.invoiceNumber,
      trackingId: r.trackingId || 'N/A',
      name: r.name,
      mobileNo: r.mobileNo,
      codAmount: Number(r.codAmount) || 0,
      paymentStatus: r.paymentStatus || 'N/A',
    }));
  }

  // =========================================================================
  // EXCHANGE ORDER PRODUCT — kept transactional as before, now with locked
  // reads for the inventory rows it touches before increment.
  // =========================================================================
  async exchangeOrderProduct(payload: {
    orderId: number;
    oldProductId: string;
    oldQuantity: number;
    newProductId: string;
    newQuantity: number;
    agentId: string;
    reason?: string;
  }) {
    const { orderId, oldProductId, oldQuantity, newProductId, newQuantity, agentId, reason } = payload;

    if (!(oldQuantity > 0) || !(newQuantity > 0)) {
      throw new BadRequestException('Exchange quantities must be greater than zero');
    }

    const originalOrder = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['status'],
    });
    if (!originalOrder) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Order does not exist');
    }
    if (!originalOrder.status || originalOrder.status.label !== 'Delivered') {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        `Order must be in "Delivered" status to exchange (current: ${originalOrder.status?.label || 'unknown'})`,
      );
    }

    const orderProduct = await this.productsRepository.findOne({
      where: { orderId, productId: oldProductId },
    });
    if (!orderProduct) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Product not found in this order');
    }
    if (oldQuantity > orderProduct.productQuantity) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Exchange quantity exceeds ordered quantity');
    }

    const newProductInfo = await this.productRepository.findOne({ where: { id: newProductId } });
    if (!newProductInfo) {
      throw new NotFoundException(`Product with ID ${newProductId} not found`);
    }

    const oldSubtotal = orderProduct.productPrice * oldQuantity;
    const newSubtotal = newProductInfo.salePrice * newQuantity;
    const priceDifference = newSubtotal - oldSubtotal;

    // These each run their own short transaction and commit before we open
    // the main queryRunner below — avoids holding this transaction's locks
    // while waiting on the numbering locks.
    const newOrderNumber = await this.generateOrderNumber(originalOrder.organizationId);
    const newInvoiceNumber = await this.generateInvoiceNumber(originalOrder.organizationId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      // ---- ধাপ ১: পুরনো product return করা ----
      const oldInventory = await this.lockInventory(manager, oldProductId);
      const oldInventoryItem = originalOrder.locationId
        ? await this.lockInventoryItem(manager, oldProductId, originalOrder.locationId)
        : null;

      if (oldInventory) {
        await manager.increment(Inventory, { productId: oldProductId }, 'stock', oldQuantity);
      }
      if (oldInventoryItem) {
        await manager.increment(
          InventoryItem,
          { productId: oldProductId, locationId: originalOrder.locationId },
          'quantity',
          oldQuantity,
        );
      }

      await manager.save(OrderProductReturn, {
        orderId: originalOrder.id,
        productId: oldProductId,
        returnQuantity: oldQuantity,
        damageQuantity: 0,
        reason: reason || 'Exchanged for another product',
        remarks: 'Returned as part of a product exchange',
        returnDate: new Date(),
      });

      const fullyReturned = oldQuantity === orderProduct.productQuantity;
      await manager.update(
        Order,
        { id: originalOrder.id },
        { statusId: fullyReturned ? 10 : 12 },
      );

      // ---- ধাপ ২: নতুন order তৈরি (numbers আগেই generate হয়ে গেছে) ----
      const newOrder = await manager.save(Order, {
        orderNumber: newOrderNumber,
        invoiceNumber: newInvoiceNumber,
        parentOrderId: originalOrder.id,
        customerId: originalOrder.customerId,
        receiverName: originalOrder.receiverName,
        receiverPhoneNumber: originalOrder.receiverPhoneNumber,
        receiverAddress: originalOrder.receiverAddress,
        receiverDivision: originalOrder.receiverDivision,
        receiverDistrict: originalOrder.receiverDistrict,
        receiverThana: originalOrder.receiverThana,
        organizationId: originalOrder.organizationId,
        locationId: originalOrder.locationId,
        currier: originalOrder.currier,
        addressId: originalOrder.addressId,
        orderSource: 'Exchange',
        orderType: 'Exchange',
        statusId: OrderStatusId.Approved,
        shippingCharge: 0,
        discount: 0,
        productValue: newSubtotal,
        totalPrice: newSubtotal,
        totalPaidAmount: 0,
        totalReceiveAbleAmount: newSubtotal,
        agentId,
      });

      await manager.save(Products, {
        orderId: newOrder.id,
        productId: newProductId,
        productQuantity: newQuantity,
        productPrice: newProductInfo.salePrice,
        subtotal: newSubtotal,
      });

      const newInventory = await this.ensureInventory(
        manager,
        newProductId,
        originalOrder.organizationId,
      );
      await manager.increment(
        Inventory,
        { productId: newProductId },
        'orderQue',
        newQuantity,
      );

      if (originalOrder.locationId) {
        await this.ensureInventoryItem(
          manager,
          newProductId,
          originalOrder.locationId,
          newInventory.id,
        );
        await manager.increment(
          InventoryItem,
          { productId: newProductId, locationId: originalOrder.locationId },
          'orderQue',
          newQuantity,
        );
      }

      await manager.save(OrderExchange, {
        originalOrderId: originalOrder.id,
        newOrderId: newOrder.id,
        oldProductId,
        oldQuantity,
        newProductId,
        newQuantity,
        priceDifference,
        reason: reason || 'Customer requested exchange',
        agentId,
      });

      await manager.save(OrdersLog, [
        {
          orderId: originalOrder.id,
          agentId,
          action: `${oldQuantity} unit(s) of product ${oldProductId} returned for exchange. New order ${newOrderNumber} created for ${newQuantity} unit(s) of ${newProductId}.`,
          previousValue: null,
        },
        {
          orderId: newOrder.id,
          agentId,
          action: `Order created as an exchange for order ${originalOrder.orderNumber}. Price difference: ${priceDifference}.`,
          previousValue: null,
        },
      ]);

      await queryRunner.commitTransaction();

      return { originalOrderId: originalOrder.id, newOrder, priceDifference };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof ApiError ||
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, error.message || 'Failed to process exchange');
    } finally {
      await queryRunner.release();
    }
  }
}