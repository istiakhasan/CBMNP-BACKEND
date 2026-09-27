import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DmsArea,
  DmsDeliveryTrip,
  DmsDeliveryTripOrder,
  DmsDistributor,
  DmsDistributorInventory,
  DmsPrimaryOrder,
  DmsPrimaryOrderItem,
  DmsRegion,
  DmsRetailer,
  DmsReturn,
  DmsReturnItem,
  DmsSalesOrder,
  DmsSalesOrderItem,
  DmsScheme,
  SfaCollection,
  SfaFieldAttendance,
  SfaFieldVisit,
  SfaRoute,
  SfaSalesTarget,
  SfaTerritory,
} from './entities/sfa-dms.entity';
import { GovernanceService } from '../governance/governance.service';

@Injectable()
export class SfaDmsService {
  private readonly resources: Record<string, Repository<any>>;

  constructor(
    @InjectRepository(DmsRegion) private readonly regions: Repository<DmsRegion>,
    @InjectRepository(DmsArea) private readonly areas: Repository<DmsArea>,
    @InjectRepository(SfaTerritory) private readonly territories: Repository<SfaTerritory>,
    @InjectRepository(DmsDistributor) private readonly distributors: Repository<DmsDistributor>,
    @InjectRepository(DmsRetailer) private readonly retailers: Repository<DmsRetailer>,
    @InjectRepository(SfaRoute) private readonly routes: Repository<SfaRoute>,
    @InjectRepository(SfaFieldAttendance) private readonly attendance: Repository<SfaFieldAttendance>,
    @InjectRepository(SfaFieldVisit) private readonly visits: Repository<SfaFieldVisit>,
    @InjectRepository(DmsSalesOrder) private readonly orders: Repository<DmsSalesOrder>,
    @InjectRepository(DmsSalesOrderItem) private readonly orderItems: Repository<DmsSalesOrderItem>,
    @InjectRepository(DmsPrimaryOrder) private readonly primaryOrders: Repository<DmsPrimaryOrder>,
    @InjectRepository(DmsPrimaryOrderItem) private readonly primaryOrderItems: Repository<DmsPrimaryOrderItem>,
    @InjectRepository(DmsDistributorInventory) private readonly inventory: Repository<DmsDistributorInventory>,
    @InjectRepository(SfaCollection) private readonly collections: Repository<SfaCollection>,
    @InjectRepository(DmsScheme) private readonly schemes: Repository<DmsScheme>,
    @InjectRepository(DmsDeliveryTrip) private readonly trips: Repository<DmsDeliveryTrip>,
    @InjectRepository(DmsDeliveryTripOrder) private readonly tripOrders: Repository<DmsDeliveryTripOrder>,
    @InjectRepository(DmsReturn) private readonly returns: Repository<DmsReturn>,
    @InjectRepository(DmsReturnItem) private readonly returnItems: Repository<DmsReturnItem>,
    @InjectRepository(SfaSalesTarget) private readonly targets: Repository<SfaSalesTarget>,
    private readonly governanceService: GovernanceService,
  ) {
    this.resources = {
      regions,
      areas,
      territories,
      distributors,
      retailers,
      routes,
      attendance,
      visits,
      orders,
      primaryOrders,
      inventory,
      collections,
      schemes,
      trips,
      returns,
      targets,
    };
  }

  private validate(resource: string, data: any) {
    const required: Record<string, string[]> = {
      regions: ['code', 'name'],
      areas: ['code', 'name', 'regionId'],
      territories: ['code', 'name'],
      distributors: ['code', 'name'],
      retailers: ['code', 'name'],
      routes: ['code', 'name'],
      attendance: ['salesRepId', 'date'],
      visits: ['retailerId', 'visitDate'],
      orders: ['orderNumber', 'retailerId', 'orderDate'],
      primaryOrders: ['orderNumber', 'distributorId', 'orderDate'],
      inventory: ['distributorId', 'productId'],
      collections: ['retailerId', 'collectionDate', 'amount', 'paymentMethod'],
      schemes: ['code', 'name'],
      trips: ['tripNumber', 'tripDate'],
      returns: ['returnNumber', 'retailerId', 'returnDate'],
      targets: ['salesRepId', 'period', 'salesTarget'],
    };

    const missing = (required[resource] || []).filter(
      (field) => data[field] === undefined || data[field] === null || data[field] === '',
    );
    if (missing.length) throw new BadRequestException(`Missing required fields: ${missing.join(', ')}`);
  }

  private repo(resource: string) {
    const repository = this.resources[resource];
    if (!repository) throw new BadRequestException('Unknown SFA/DMS resource');
    return repository;
  }

  // --- GENERIC CRUD ---
  async list(resource: string, organizationId: string, page = 1, limit = 20, searchTerm?: string) {
    const repository = this.repo(resource);
    const qb = repository.createQueryBuilder('item').where('item.organizationId = :organizationId', { organizationId });

    if (searchTerm && ['territories', 'distributors', 'retailers', 'routes', 'schemes', 'regions', 'areas'].includes(resource)) {
      qb.andWhere('(item.name ILIKE :searchTerm OR item.code ILIKE :searchTerm)', { searchTerm: `%${searchTerm.trim()}%` });
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 200);
    const safePage = Math.max(Number(page) || 1, 1);
    const [data, total] = await qb
      .orderBy('item.createdAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return { data, total, page: safePage, limit: safeLimit };
  }

  async getOne(resource: string, id: string, organizationId: string) {
    const repository = this.repo(resource);
    const item = await repository.findOne({ where: { id, organizationId } });
    if (!item) throw new NotFoundException(`${resource} record not found`);
    return item;
  }

  async create(resource: string, organizationId: string, data: any, userId?: string) {
    const repository = this.repo(resource);
    this.validate(resource, data);
    const payload = { ...data, organizationId };
    if (resource === 'visits' && !payload.salesRepId) payload.salesRepId = userId;
    if (resource === 'orders' && !payload.salesRepId) payload.salesRepId = userId;
    if (resource === 'collections' && !payload.salesRepId) payload.salesRepId = userId;
    if (resource === 'attendance' && !payload.salesRepId) payload.salesRepId = userId;

    const saved = await repository.save(repository.create(payload));
    await this.governanceService.logAction(
      { entityName: `SfaDms:${resource}`, entityId: saved.id, actionType: 'CREATE', newValues: saved, userId },
      organizationId,
    );
    return saved;
  }

  async update(resource: string, id: string, organizationId: string, data: any, userId?: string) {
    const repository = this.repo(resource);
    const existing = await repository.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('SFA/DMS record not found');
    const saved = await repository.save(repository.merge(existing, data));
    await this.governanceService.logAction(
      { entityName: `SfaDms:${resource}`, entityId: saved.id, actionType: 'UPDATE', previousValues: existing, newValues: saved, userId },
      organizationId,
    );
    return saved;
  }

  // --- SECONDARY SALES ORDERS WITH TRANSACTIONAL ITEMS ---
  async createSalesOrderWithItems(organizationId: string, data: any, userId?: string) {
    if (!data.retailerId || !data.orderDate) {
      throw new BadRequestException('retailerId and orderDate are required');
    }
    const retailer = await this.retailers.findOne({ where: { id: data.retailerId, organizationId } });
    if (!retailer) throw new NotFoundException('Retailer not found');

    const orderNumber = data.orderNumber || `SO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const itemsData = Array.isArray(data.items) ? data.items : [];

    let grossAmount = 0;
    let discountAmount = 0;
    let taxAmount = 0;

    const preparedItems = itemsData.map((item: any) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 0;
      const disc = Number(item.discountAmount) || 0;
      const taxRate = Number(item.taxRate) || 0;
      const basePrice = qty * price;
      const taxable = Math.max(basePrice - disc, 0);
      const tax = (taxable * taxRate) / 100;
      const lineTotal = taxable + tax;

      grossAmount += basePrice;
      discountAmount += disc;
      taxAmount += tax;

      return {
        organizationId,
        productId: item.productId,
        productName: item.productName || 'Product',
        productSku: item.productSku || '',
        uom: item.uom || 'PCS',
        quantity: qty,
        unitPrice: price,
        discountAmount: disc,
        taxRate,
        taxAmount: tax,
        lineTotal,
      };
    });

    const netAmount = Math.max(grossAmount - discountAmount + taxAmount, 0);

    // Credit limit check
    if (retailer.creditLimit && Number(retailer.creditLimit) > 0) {
      const currentOut = Number(retailer.outstandingBalance || 0);
      if (currentOut + netAmount > Number(retailer.creditLimit)) {
        // Can raise warning or allow order in Draft with warning note
        data.note = `${data.note ? `${data.note} | ` : ''}[CREDIT LIMIT EXCEEDED: Limit ${retailer.creditLimit}, Out ${currentOut}]`;
      }
    }

    const orderPayload = {
      organizationId,
      orderNumber,
      retailerId: data.retailerId,
      distributorId: data.distributorId || retailer.distributorId,
      territoryId: data.territoryId || retailer.territoryId,
      salesRepId: data.salesRepId || userId,
      orderDate: data.orderDate,
      deliveryDate: data.deliveryDate,
      status: data.status || 'Submitted',
      paymentStatus: 'Unpaid',
      grossAmount,
      discountAmount,
      taxAmount,
      netAmount,
      paidAmount: 0,
      deliveryAddress: data.deliveryAddress || retailer.address,
      note: data.note,
    };

    const savedOrder = await this.orders.save(this.orders.create(orderPayload));

    if (preparedItems.length > 0) {
      const itemsToSave = preparedItems.map((pi) => this.orderItems.create({ ...pi, orderId: savedOrder.id }));
      await this.orderItems.save(itemsToSave);
    }

    // Update retailer outstanding
    retailer.outstandingBalance = Number(retailer.outstandingBalance || 0) + netAmount;
    await this.retailers.save(retailer);

    await this.governanceService.logAction(
      { entityName: 'SfaDms:orders', entityId: savedOrder.id, actionType: 'CREATE', newValues: savedOrder, userId },
      organizationId,
    );

    return { ...savedOrder, items: preparedItems };
  }

  async getOrderItems(orderId: string, organizationId: string) {
    return this.orderItems.find({ where: { orderId, organizationId } });
  }

  async updateSalesOrderStatus(organizationId: string, orderId: string, status: string, userId?: string, note?: string) {
    const order = await this.orders.findOne({ where: { id: orderId, organizationId } });
    if (!order) throw new NotFoundException('Sales order not found');

    const validStatuses = ['Draft', 'Submitted', 'Approved', 'Dispatched', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}. Must be one of ${validStatuses.join(', ')}`);
    }

    const previousStatus = order.status;
    order.status = status;
    if (note) order.note = `${order.note ? `${order.note} | ` : ''}${note}`;

    // On Delivered: deduct distributor stock if distributor inventory exists
    if (status === 'Delivered' && order.distributorId) {
      const items = await this.orderItems.find({ where: { orderId, organizationId } });
      for (const item of items) {
        const inv = await this.inventory.findOne({
          where: { organizationId, distributorId: order.distributorId, productId: item.productId },
        });
        if (inv) {
          inv.availableQuantity = Math.max(Number(inv.availableQuantity || 0) - item.quantity, 0);
          await this.inventory.save(inv);
        }
      }
    }

    const saved = await this.orders.save(order);
    await this.governanceService.logAction(
      {
        entityName: 'SfaDms:orders',
        entityId: saved.id,
        actionType: 'STATUS_CHANGE',
        previousValues: { status: previousStatus },
        newValues: { status: saved.status },
        userId,
      },
      organizationId,
    );
    return saved;
  }

  // --- PRIMARY SALES ORDERS (COMPANY -> DISTRIBUTOR) ---
  async createPrimaryOrderWithItems(organizationId: string, data: any, userId?: string) {
    if (!data.distributorId || !data.orderDate) {
      throw new BadRequestException('distributorId and orderDate are required');
    }
    const distributor = await this.distributors.findOne({ where: { id: data.distributorId, organizationId } });
    if (!distributor) throw new NotFoundException('Distributor not found');

    const orderNumber = data.orderNumber || `PO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const itemsData = Array.isArray(data.items) ? data.items : [];

    let grossAmount = 0;
    let discountAmount = 0;

    const preparedItems = itemsData.map((item: any) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 0;
      const disc = Number(item.discountAmount) || 0;
      const lineTotal = Math.max(qty * price - disc, 0);
      grossAmount += qty * price;
      discountAmount += disc;
      return {
        organizationId,
        productId: item.productId,
        productName: item.productName || 'Product',
        productSku: item.productSku || '',
        uom: item.uom || 'PCS',
        quantity: qty,
        allocatedQuantity: qty,
        unitPrice: price,
        discountAmount: disc,
        lineTotal,
      };
    });

    const netAmount = Math.max(grossAmount - discountAmount, 0);

    const savedOrder = await this.primaryOrders.save(
      this.primaryOrders.create({
        organizationId,
        orderNumber,
        distributorId: data.distributorId,
        warehouseId: data.warehouseId || distributor.warehouseId,
        orderDate: data.orderDate,
        expectedDeliveryDate: data.expectedDeliveryDate,
        status: data.status || 'Submitted',
        paymentStatus: 'Unpaid',
        grossAmount,
        discountAmount,
        taxAmount: 0,
        netAmount,
        paidAmount: 0,
        notes: data.notes,
      }),
    );

    if (preparedItems.length > 0) {
      const itemsToSave = preparedItems.map((pi) => this.primaryOrderItems.create({ ...pi, orderId: savedOrder.id }));
      await this.primaryOrderItems.save(itemsToSave);
    }

    await this.governanceService.logAction(
      { entityName: 'SfaDms:primaryOrders', entityId: savedOrder.id, actionType: 'CREATE', newValues: savedOrder, userId },
      organizationId,
    );

    return { ...savedOrder, items: preparedItems };
  }

  async getPrimaryOrderItems(orderId: string, organizationId: string) {
    return this.primaryOrderItems.find({ where: { orderId, organizationId } });
  }

  async updatePrimaryOrderStatus(organizationId: string, orderId: string, status: string, userId?: string) {
    const order = await this.primaryOrders.findOne({ where: { id: orderId, organizationId } });
    if (!order) throw new NotFoundException('Primary order not found');

    const validStatuses = ['Draft', 'Submitted', 'Approved', 'Allocated', 'Dispatched', 'Received', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}. Must be one of ${validStatuses.join(', ')}`);
    }

    const previousStatus = order.status;
    order.status = status;

    // When received by distributor: increment distributor inventory!
    if (status === 'Received') {
      const items = await this.primaryOrderItems.find({ where: { orderId, organizationId } });
      for (const item of items) {
        let inv = await this.inventory.findOne({
          where: { organizationId, distributorId: order.distributorId, productId: item.productId },
        });
        if (!inv) {
          inv = this.inventory.create({
            organizationId,
            distributorId: order.distributorId,
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            uom: item.uom,
            availableQuantity: item.quantity,
            reservedQuantity: 0,
            lastRestockedAt: new Date(),
          });
        } else {
          inv.availableQuantity = Number(inv.availableQuantity || 0) + item.quantity;
          inv.lastRestockedAt = new Date();
        }
        await this.inventory.save(inv);
      }
    }

    const saved = await this.primaryOrders.save(order);
    await this.governanceService.logAction(
      {
        entityName: 'SfaDms:primaryOrders',
        entityId: saved.id,
        actionType: 'STATUS_CHANGE',
        previousValues: { status: previousStatus },
        newValues: { status: saved.status },
        userId,
      },
      organizationId,
    );
    return saved;
  }

  // --- DISTRIBUTOR ONBOARDING & APPROVALS ---
  async updateDistributorOnboarding(organizationId: string, distributorId: string, onboardingStatus: string, blockedReason?: string, userId?: string) {
    const distributor = await this.distributors.findOne({ where: { id: distributorId, organizationId } });
    if (!distributor) throw new NotFoundException('Distributor not found');

    const validStatuses = ['Draft', 'Pending Approval', 'Approved', 'Blocked'];
    if (!validStatuses.includes(onboardingStatus)) {
      throw new BadRequestException(`Invalid status: ${onboardingStatus}`);
    }

    distributor.onboardingStatus = onboardingStatus;
    if (blockedReason) distributor.blockedReason = blockedReason;
    if (onboardingStatus === 'Approved') distributor.active = true;
    if (onboardingStatus === 'Blocked') distributor.active = false;

    const saved = await this.distributors.save(distributor);
    await this.governanceService.logAction(
      { entityName: 'SfaDms:distributors', entityId: saved.id, actionType: 'ONBOARDING_STATUS', newValues: { onboardingStatus, blockedReason }, userId },
      organizationId,
    );
    return saved;
  }

  // --- FIELD ATTENDANCE & VISITS ---
  async checkInAttendance(organizationId: string, salesRepId: string, lat?: number, lng?: number, date?: string) {
    const attendanceDate = date || new Date().toISOString().slice(0, 10);
    let record = await this.attendance.findOne({ where: { organizationId, salesRepId, date: attendanceDate } });
    if (!record) {
      record = this.attendance.create({
        organizationId,
        salesRepId,
        date: attendanceDate,
        checkInTime: new Date(),
        checkInLatitude: lat,
        checkInLongitude: lng,
        status: 'Present',
        totalVisits: 0,
      });
    } else {
      record.checkInTime = new Date();
      if (lat) record.checkInLatitude = lat;
      if (lng) record.checkInLongitude = lng;
    }
    return this.attendance.save(record);
  }

  async checkOutAttendance(organizationId: string, salesRepId: string, lat?: number, lng?: number, date?: string, remarks?: string) {
    const attendanceDate = date || new Date().toISOString().slice(0, 10);
    const record = await this.attendance.findOne({ where: { organizationId, salesRepId, date: attendanceDate } });
    if (!record) throw new NotFoundException('Attendance record not found for today');

    record.checkOutTime = new Date();
    if (lat) record.checkOutLatitude = lat;
    if (lng) record.checkOutLongitude = lng;
    if (remarks) record.remarks = remarks;

    return this.attendance.save(record);
  }

  async checkInFieldVisit(organizationId: string, visitId: string, lat?: number, lng?: number, userId?: string) {
    const visit = await this.visits.findOne({ where: { id: visitId, organizationId } });
    if (!visit) throw new NotFoundException('Field visit record not found');

    visit.checkInAt = new Date();
    if (lat) visit.checkInLatitude = lat;
    if (lng) visit.checkInLongitude = lng;
    visit.status = 'In Progress';

    return this.visits.save(visit);
  }

  async checkOutFieldVisit(organizationId: string, visitId: string, data: any, userId?: string) {
    const visit = await this.visits.findOne({ where: { id: visitId, organizationId } });
    if (!visit) throw new NotFoundException('Field visit record not found');

    visit.checkOutAt = new Date();
    if (data.lat) visit.checkOutLatitude = data.lat;
    if (data.lng) visit.checkOutLongitude = data.lng;
    if (data.outcome) visit.outcome = data.outcome;
    if (data.orderAmount) visit.orderAmount = Number(data.orderAmount);
    if (data.collectionAmount) visit.collectionAmount = Number(data.collectionAmount);
    if (data.note) visit.note = data.note;
    if (data.photoUrl) visit.photoUrl = data.photoUrl;
    visit.status = 'Completed';

    // Increment attendance visits count
    const today = visit.visitDate;
    const repAttendance = await this.attendance.findOne({ where: { organizationId, salesRepId: visit.salesRepId, date: today } });
    if (repAttendance) {
      repAttendance.totalVisits = (repAttendance.totalVisits || 0) + 1;
      await this.attendance.save(repAttendance);
    }

    return this.visits.save(visit);
  }

  // --- COLLECTIONS VERIFICATION ---
  async verifyCollection(organizationId: string, collectionId: string, status: string, depositDate?: string, userId?: string, note?: string) {
    const coll = await this.collections.findOne({ where: { id: collectionId, organizationId } });
    if (!coll) throw new NotFoundException('Collection record not found');

    const validStatuses = ['Submitted', 'Verified', 'Deposited', 'Bounced', 'Rejected'];
    if (!validStatuses.includes(status)) throw new BadRequestException(`Invalid collection status: ${status}`);

    const previousStatus = coll.status;
    coll.status = status;
    coll.verifiedBy = userId;
    coll.verifiedAt = new Date();
    if (depositDate) coll.depositDate = depositDate;
    if (note) coll.note = `${coll.note ? `${coll.note} | ` : ''}${note}`;

    // If verified or deposited: reduce retailer outstanding balance!
    if (['Verified', 'Deposited'].includes(status) && !['Verified', 'Deposited'].includes(previousStatus)) {
      const retailer = await this.retailers.findOne({ where: { id: coll.retailerId, organizationId } });
      if (retailer) {
        retailer.outstandingBalance = Math.max(Number(retailer.outstandingBalance || 0) - Number(coll.amount), 0);
        await this.retailers.save(retailer);
      }
    }

    const saved = await this.collections.save(coll);
    await this.governanceService.logAction(
      {
        entityName: 'SfaDms:collections',
        entityId: saved.id,
        actionType: 'VERIFY_PAYMENT',
        previousValues: { status: previousStatus },
        newValues: { status: saved.status, depositDate },
        userId,
      },
      organizationId,
    );
    return saved;
  }

  // --- DELIVERY TRIPS ---
  async createDeliveryTrip(organizationId: string, data: any, userId?: string) {
    const tripNumber = data.tripNumber || `TRIP-${Date.now()}`;
    const orderIds: string[] = Array.isArray(data.orderIds) ? data.orderIds : [];

    let totalAmount = 0;
    const orders = orderIds.length > 0 ? await this.orders.findByIds(orderIds) : [];
    for (const ord of orders) {
      totalAmount += Number(ord.netAmount || 0);
      ord.status = 'Dispatched';
      await this.orders.save(ord);
    }

    const trip = await this.trips.save(
      this.trips.create({
        organizationId,
        tripNumber,
        distributorId: data.distributorId,
        driverName: data.driverName,
        driverPhone: data.driverPhone,
        vehicleNumber: data.vehicleNumber,
        tripDate: data.tripDate || new Date().toISOString().slice(0, 10),
        status: 'Scheduled',
        totalOrders: orders.length,
        deliveredOrders: 0,
        totalAmount,
        note: data.note,
      }),
    );

    if (orders.length > 0) {
      const tripOrderItems = orders.map((ord, idx) =>
        this.tripOrders.create({
          organizationId,
          tripId: trip.id,
          orderId: ord.id,
          sequence: idx + 1,
          deliveryStatus: 'Pending',
        }),
      );
      await this.tripOrders.save(tripOrderItems);
    }

    return trip;
  }

  async updateTripStatus(organizationId: string, tripId: string, status: string, orderDeliveries?: any[], userId?: string) {
    const trip = await this.trips.findOne({ where: { id: tripId, organizationId } });
    if (!trip) throw new NotFoundException('Delivery trip not found');

    trip.status = status;

    if (Array.isArray(orderDeliveries)) {
      let deliveredCount = 0;
      for (const item of orderDeliveries) {
        const tripOrder = await this.tripOrders.findOne({ where: { tripId, orderId: item.orderId, organizationId } });
        if (tripOrder) {
          tripOrder.deliveryStatus = item.deliveryStatus;
          if (item.failureReason) tripOrder.failureReason = item.failureReason;
          if (item.deliveryStatus === 'Delivered') {
            tripOrder.deliveredAt = new Date();
            deliveredCount++;
            await this.updateSalesOrderStatus(organizationId, item.orderId, 'Delivered', userId);
          }
          await this.tripOrders.save(tripOrder);
        }
      }
      trip.deliveredOrders = deliveredCount;
    }

    return this.trips.save(trip);
  }

  // --- RETURNS & CLAIMS ---
  async createReturnWithItems(organizationId: string, data: any, userId?: string) {
    const returnNumber = data.returnNumber || `RET-${Date.now()}`;
    const itemsData = Array.isArray(data.items) ? data.items : [];

    let totalAmount = 0;
    const preparedItems = itemsData.map((item: any) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 0;
      const lineTotal = qty * price;
      totalAmount += lineTotal;
      return {
        organizationId,
        productId: item.productId,
        productName: item.productName || 'Product',
        quantity: qty,
        unitPrice: price,
        lineTotal,
        reason: item.reason || data.returnType || 'Damage',
      };
    });

    const savedReturn = await this.returns.save(
      this.returns.create({
        organizationId,
        returnNumber,
        distributorId: data.distributorId,
        retailerId: data.retailerId,
        returnDate: data.returnDate || new Date().toISOString().slice(0, 10),
        returnType: data.returnType || 'Damage',
        status: 'Pending',
        totalAmount,
        note: data.note,
      }),
    );

    if (preparedItems.length > 0) {
      const itemsToSave = preparedItems.map((pi) => this.returnItems.create({ ...pi, returnId: savedReturn.id }));
      await this.returnItems.save(itemsToSave);
    }

    return { ...savedReturn, items: preparedItems };
  }

  // --- REPORTS & KPIS ---
  async getTargetsAchievementReport(organizationId: string, period?: string, salesRepId?: string) {
    const currentPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM
    const qb = this.targets.createQueryBuilder('t').where('t.organizationId = :organizationId', { organizationId }).andWhere('t.period = :period', { period: currentPeriod });
    if (salesRepId) qb.andWhere('t.salesRepId = :salesRepId', { salesRepId });

    const targetList = await qb.getMany();

    // Calculate actual achievements from orders, collections, visits
    const results = await Promise.all(
      targetList.map(async (t) => {
        const orderSum = await this.orders
          .createQueryBuilder('o')
          .where('o.organizationId = :organizationId', { organizationId })
          .andWhere('o.salesRepId = :repId', { repId: t.salesRepId })
          .andWhere('o.orderDate LIKE :monthPrefix', { monthPrefix: `${currentPeriod}%` })
          .andWhere('o.status NOT IN (:...bad)', { bad: ['Draft', 'Cancelled'] })
          .select('COALESCE(SUM(o.netAmount), 0)', 'total')
          .getRawOne();

        const collSum = await this.collections
          .createQueryBuilder('c')
          .where('c.organizationId = :organizationId', { organizationId })
          .andWhere('c.salesRepId = :repId', { repId: t.salesRepId })
          .andWhere('c.collectionDate LIKE :monthPrefix', { monthPrefix: `${currentPeriod}%` })
          .andWhere('c.status IN (:...verified)', { verified: ['Verified', 'Deposited'] })
          .select('COALESCE(SUM(c.amount), 0)', 'total')
          .getRawOne();

        const visitCount = await this.visits.count({
          where: { organizationId, salesRepId: t.salesRepId, status: 'Completed' },
        });

        const actualSales = Number(orderSum?.total || 0);
        const actualCollection = Number(collSum?.total || 0);
        const salesAchievedPct = t.salesTarget > 0 ? (actualSales / Number(t.salesTarget)) * 100 : 0;
        const collAchievedPct = t.collectionTarget > 0 ? (actualCollection / Number(t.collectionTarget)) * 100 : 0;
        const visitAchievedPct = t.visitTarget > 0 ? (visitCount / Number(t.visitTarget)) * 100 : 0;

        return {
          id: t.id,
          salesRepId: t.salesRepId,
          period: t.period,
          salesTarget: Number(t.salesTarget),
          collectionTarget: Number(t.collectionTarget),
          visitTarget: Number(t.visitTarget),
          actualSales,
          actualCollection,
          actualVisits: visitCount,
          salesAchievedPct: Number(salesAchievedPct.toFixed(1)),
          collectionAchievedPct: Number(collAchievedPct.toFixed(1)),
          visitAchievedPct: Number(visitAchievedPct.toFixed(1)),
        };
      }),
    );

    return results;
  }

  async getDistributorStockReport(organizationId: string, distributorId?: string) {
    const qb = this.inventory.createQueryBuilder('inv').where('inv.organizationId = :organizationId', { organizationId });
    if (distributorId) qb.andWhere('inv.distributorId = :distributorId', { distributorId });
    return qb.orderBy('inv.availableQuantity', 'ASC').getMany();
  }

  // --- DASHBOARD ---
  async dashboard(organizationId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const [
      territories,
      distributors,
      retailers,
      routes,
      visitsToday,
      ordersToday,
      collectionsToday,
      pendingOrders,
      pendingPrimary,
      attendanceToday,
    ] = await Promise.all([
      this.territories.count({ where: { organizationId, active: true } }),
      this.distributors.count({ where: { organizationId, active: true } }),
      this.retailers.count({ where: { organizationId, active: true } }),
      this.routes.count({ where: { organizationId, active: true } }),
      this.visits.count({ where: { organizationId, visitDate: today } }),
      this.orders.count({ where: { organizationId, orderDate: today } }),
      this.collections
        .createQueryBuilder('c')
        .where('c.organizationId = :organizationId', { organizationId })
        .andWhere('c.collectionDate = :today', { today })
        .select('COALESCE(SUM(c.amount), 0)', 'amount')
        .getRawOne(),
      this.orders.count({ where: { organizationId, status: 'Submitted' } }),
      this.primaryOrders.count({ where: { organizationId, status: 'Submitted' } }),
      this.attendance.count({ where: { organizationId, date: today, status: 'Present' } }),
    ]);

    return {
      territories,
      distributors,
      retailers,
      routes,
      visitsToday,
      ordersToday,
      collectionToday: Number(collectionsToday?.amount || 0),
      pendingOrders,
      pendingPrimaryOrders: pendingPrimary,
      attendanceToday,
    };
  }
}

