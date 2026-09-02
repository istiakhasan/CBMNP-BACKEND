import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Quotation, QuotationStatus } from './entities/quotation.entity';
import { QuotationItem } from './entities/quotation-item.entity';
import { Coupon, CouponDiscountType } from './entities/coupon.entity';
import { CouponUsage } from './entities/coupon-usage.entity';
import { CustomerCreditProfile } from './entities/customer-credit-profile.entity';
import { PosRegisterSession, PosSessionStatus } from './entities/pos-register-session.entity';
import { PosCashMovement, CashMovementType } from './entities/pos-cash-movement.entity';
import { Order } from '../order/entities/order.entity';
import { Products as OrderProduct } from '../order/entities/products.entity';
import { Customers } from '../customers/entities/customers.entity';

@Injectable()
export class SalesOperationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Quotation)
    private readonly quotationRepo: Repository<Quotation>,
    @InjectRepository(QuotationItem)
    private readonly quotationItemRepo: Repository<QuotationItem>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(CouponUsage)
    private readonly couponUsageRepo: Repository<CouponUsage>,
    @InjectRepository(CustomerCreditProfile)
    private readonly creditProfileRepo: Repository<CustomerCreditProfile>,
    @InjectRepository(PosRegisterSession)
    private readonly posSessionRepo: Repository<PosRegisterSession>,
    @InjectRepository(PosCashMovement)
    private readonly posCashMovementRepo: Repository<PosCashMovement>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderProduct)
    private readonly orderProductRepo: Repository<OrderProduct>,
    @InjectRepository(Customers)
    private readonly customerRepo: Repository<Customers>,
  ) {}

  // ================= QUOTATIONS =================
  async createQuotation(data: any, organizationId: string, userId?: string): Promise<Quotation> {
    const year = new Date().getFullYear();
    const quotationNumber = `QT-${year}-${Date.now().toString().slice(-6)}`;

    let subTotal = 0;
    (data.items || []).forEach((i: any) => {
      subTotal += Number(i.quantity || 0) * Number(i.unitPrice || 0);
    });

    const discountAmount = Number(data.discountAmount || 0);
    const deliveryCharge = Number(data.deliveryCharge || 0);
    const grandTotal = subTotal - discountAmount + deliveryCharge;

    const quotation = this.quotationRepo.create({
      quotationNumber,
      quotationDate: data.quotationDate || new Date().toISOString().split('T')[0],
      expiryDate: data.expiryDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      customerId: data.customerId,
      subTotal,
      discountAmount,
      deliveryCharge,
      grandTotal,
      status: QuotationStatus.DRAFT,
      termsAndConditions: data.termsAndConditions,
      notes: data.notes,
      createdById: userId,
      organizationId,
    });

    const saved = await this.quotationRepo.save(quotation);

    if (data.items && Array.isArray(data.items)) {
      const items = data.items.map((i: any) => {
        const qty = Number(i.quantity || 0);
        const unitPrice = Number(i.unitPrice || 0);
        const disc = Number(i.discountAmount || 0);
        return this.quotationItemRepo.create({
          quotationId: saved.id,
          productId: i.productId,
          quantity: qty,
          unitPrice,
          discountAmount: disc,
          totalPrice: qty * unitPrice - disc,
          organizationId,
        });
      });
      await this.quotationItemRepo.save(items);
    }

    return this.quotationRepo.findOne({
      where: { id: saved.id },
      relations: ['items', 'items.product', 'customer'],
    }) as Promise<Quotation>;
  }

  async convertQuotationToOrder(quotationId: string, organizationId: string, userId?: string) {
    return this.dataSource.transaction(async (manager) => {
      const q = await manager.findOne(Quotation, {
        where: { id: quotationId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!q) throw new NotFoundException('Quotation not found');
      if (q.status === QuotationStatus.CONVERTED) {
        throw new BadRequestException('Quotation has already been converted to an Order');
      }

      const items = await manager.find(QuotationItem, {
        where: { quotationId: q.id },
      });
      q.items = items;

      const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

      // Create new Order entity compatible with existing system
      const order = manager.create(Order, {
        orderNumber,
        customerId: String(q.customerId),
        totalPrice: Number(q.grandTotal),
        discount: Number(q.discountAmount),
        shippingCharge: Number(q.deliveryCharge),
        statusId: 1, // Pending
        organizationId,
        agentId: userId,
      });

      const savedOrder = await manager.save(order);

      // Create OrderProduct line items
      for (const item of q.items) {
        const op = manager.create(OrderProduct, {
          order: savedOrder,
          productId: item.productId,
          productQuantity: item.quantity,
          productPrice: Number(item.unitPrice),
          subtotal: Number(item.totalPrice),
        });
        await manager.save(op);
      }

      q.status = QuotationStatus.CONVERTED;
      q.convertedOrderId = orderNumber;
      await manager.save(q);

      return {
        message: 'Quotation successfully converted to Order',
        order: savedOrder,
        quotation: q,
      };
    });
  }

  async getQuotations(organizationId: string) {
    return this.quotationRepo.find({
      where: { organizationId },
      order: { quotationDate: 'DESC' },
      relations: ['customer', 'items', 'items.product'],
    });
  }

  // ================= COUPONS & PROMOTIONS =================
  async createCoupon(data: Partial<Coupon>, organizationId: string): Promise<Coupon> {
    const code = data.code?.trim().toUpperCase();
    const existing = await this.couponRepo.findOne({ where: { organizationId, code } });
    if (existing) throw new BadRequestException(`Coupon code '${code}' already exists`);

    const coupon = this.couponRepo.create({
      ...data,
      code,
      organizationId,
    });
    return this.couponRepo.save(coupon);
  }

  async validateCoupon(code: string, orderAmount: number, customerId: string, organizationId: string) {
    const coupon = await this.couponRepo.findOne({
      where: { organizationId, code: code.trim().toUpperCase(), isActive: true },
    });

    if (!coupon) throw new NotFoundException('Invalid or inactive promo coupon');

    const today = new Date().toISOString().split('T')[0];
    if (coupon.startDate && coupon.startDate > today) {
      throw new BadRequestException('Coupon campaign has not started yet');
    }
    if (coupon.endDate && coupon.endDate < today) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.minOrderValue && orderAmount < Number(coupon.minOrderValue)) {
      throw new BadRequestException(`Minimum order value of ${coupon.minOrderValue} Tk required for this coupon`);
    }
    if (coupon.totalUsageLimit > 0 && coupon.timesUsed >= coupon.totalUsageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    let discount = 0;
    if (coupon.discountType === CouponDiscountType.PERCENTAGE) {
      discount = (orderAmount * Number(coupon.discountValue)) / 100;
      if (coupon.maxDiscountAmount && discount > Number(coupon.maxDiscountAmount)) {
        discount = Number(coupon.maxDiscountAmount);
      }
    } else {
      discount = Number(coupon.discountValue);
    }

    return {
      isValid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountAmount: Math.min(discount, orderAmount),
    };
  }

  // ================= CUSTOMER CREDIT LIMITS =================
  async setCreditLimit(data: Partial<CustomerCreditProfile>, organizationId: string): Promise<CustomerCreditProfile> {
    let profile = await this.creditProfileRepo.findOne({
      where: { organizationId, customerId: data.customerId },
    });

    if (profile) {
      Object.assign(profile, data);
    } else {
      profile = this.creditProfileRepo.create({ ...data, organizationId });
    }
    return this.creditProfileRepo.save(profile);
  }

  async checkCustomerCredit(customerId: string | number, organizationId: string) {
    const profile = await this.creditProfileRepo.findOne({
      where: { organizationId, customerId: Number(customerId) },
      relations: ['customer'],
    });

    if (!profile) {
      return { hasCreditLimit: false, isAllowed: true, creditLimit: 0, currentDue: 0 };
    }

    const isBreached = Number(profile.currentDueAmount || 0) >= Number(profile.creditLimit || 0);

    return {
      hasCreditLimit: true,
      creditLimit: Number(profile.creditLimit),
      currentDue: Number(profile.currentDueAmount),
      availableCredit: Math.max(0, Number(profile.creditLimit) - Number(profile.currentDueAmount)),
      isBlocked: profile.isBlocked || isBreached,
      blockReason: profile.blockReason || (isBreached ? 'Credit limit exceeded' : null),
    };
  }

  // ================= POS CASH REGISTER SESSIONS =================
  async openPosSession(data: any, organizationId: string, cashierId: string): Promise<PosRegisterSession> {
    const active = await this.posSessionRepo.findOne({
      where: { organizationId, cashierId, status: PosSessionStatus.OPEN },
    });
    if (active) throw new BadRequestException('You already have an open POS session. Please close it first.');

    const year = new Date().getFullYear();
    const sessionNumber = `POS-${year}-${Date.now().toString().slice(-6)}`;

    const session = this.posSessionRepo.create({
      sessionNumber,
      cashierId,
      warehouseId: data.warehouseId,
      openedAt: new Date(),
      openingCash: Number(data.openingCash || 0),
      totalCashSales: 0,
      totalMfsSales: 0,
      totalCashIn: 0,
      totalCashOut: 0,
      status: PosSessionStatus.OPEN,
      organizationId,
    });

    return this.posSessionRepo.save(session);
  }

  async recordCashMovement(data: any, organizationId: string, userId?: string): Promise<PosCashMovement> {
    const session = await this.posSessionRepo.findOne({
      where: { id: data.sessionId, organizationId, status: PosSessionStatus.OPEN },
    });
    if (!session) throw new NotFoundException('Active POS session not found');

    const amount = Number(data.amount || 0);
    const movement = this.posCashMovementRepo.create({
      sessionId: data.sessionId,
      type: data.type,
      amount,
      reason: data.reason,
      createdById: userId,
      organizationId,
    });

    await this.posCashMovementRepo.save(movement);

    if (data.type === CashMovementType.CASH_IN) {
      session.totalCashIn = Number(session.totalCashIn || 0) + amount;
    } else {
      session.totalCashOut = Number(session.totalCashOut || 0) + amount;
    }
    await this.posSessionRepo.save(session);

    return movement;
  }

  async closePosSession(sessionId: string, actualClosingCash: number, closingNotes: string, organizationId: string): Promise<PosRegisterSession> {
    const session = await this.posSessionRepo.findOne({
      where: { id: sessionId, organizationId },
    });
    if (!session) throw new NotFoundException('POS session not found');
    if (session.status === PosSessionStatus.CLOSED) throw new BadRequestException('Session is already closed');

    const expected =
      Number(session.openingCash || 0) +
      Number(session.totalCashSales || 0) +
      Number(session.totalCashIn || 0) -
      Number(session.totalCashOut || 0);

    const actual = Number(actualClosingCash || 0);
    const variance = actual - expected;

    session.closedAt = new Date();
    session.expectedClosingCash = expected;
    session.actualClosingCash = actual;
    session.cashVariance = variance;
    session.closingNotes = closingNotes;
    session.status = PosSessionStatus.CLOSED;

    return this.posSessionRepo.save(session);
  }

  async getPosSessions(organizationId: string) {
    return this.posSessionRepo.find({
      where: { organizationId },
      order: { openedAt: 'DESC' },
      relations: ['warehouse', 'movements'],
    });
  }
}
