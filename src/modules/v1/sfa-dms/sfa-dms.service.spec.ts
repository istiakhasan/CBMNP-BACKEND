import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SfaDmsService } from './sfa-dms.service';
import { createDmsRepositoryMock } from '../../../test/helpers/dms-repository.mock';

describe('SfaDmsService', () => {
  // 20 repositories
  const repos = Array.from({ length: 20 }, createDmsRepositoryMock);
  const [
    regions,
    areas,
    territories,
    distributors,
    retailers,
    routes,
    attendance,
    visits,
    orders,
    orderItems,
    primaryOrders,
    primaryOrderItems,
    inventory,
    collections,
    schemes,
    trips,
    tripOrders,
    returns,
    returnItems,
    targets,
  ] = repos;

  const governance = { logAction: jest.fn() };
  let service: SfaDmsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SfaDmsService(
      regions as any,
      areas as any,
      territories as any,
      distributors as any,
      retailers as any,
      routes as any,
      attendance as any,
      visits as any,
      orders as any,
      orderItems as any,
      primaryOrders as any,
      primaryOrderItems as any,
      inventory as any,
      collections as any,
      schemes as any,
      trips as any,
      tripOrders as any,
      returns as any,
      returnItems as any,
      targets as any,
      governance as any,
    );
  });

  describe('Master data & Generic CRUD', () => {
    it('creates a distributor only when required identity fields are supplied and audits it', async () => {
      const result = await service.create('distributors', 'org-id', { code: 'D-001', name: 'Dhaka Distributor' }, 'user-id');
      expect(result.organizationId).toBe('org-id');
      expect(governance.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'CREATE', entityName: 'SfaDms:distributors', userId: 'user-id' }),
        'org-id',
      );
    });

    it('rejects incomplete master data', async () => {
      await expect(service.create('distributors', 'org-id', { code: 'D-001' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires a parent region when creating an area', async () => {
      await expect(service.create('areas', 'org-id', { code: 'A-001', name: 'Dhaka North' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws error for unknown resource', async () => {
      await expect(service.create('nonExistentResource', 'org-id', {})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('Secondary Sales Orders with Items', () => {
    it('creates a sales order with line items, calculates gross/net totals and updates retailer balance', async () => {
      retailers.findOne.mockResolvedValueOnce({
        id: 'ret-1',
        organizationId: 'org-id',
        distributorId: 'dist-1',
        territoryId: 'tert-1',
        creditLimit: 50000,
        outstandingBalance: 1000,
      });

      const payload = {
        retailerId: 'ret-1',
        orderDate: '2026-09-21',
        items: [
          { productId: 'prod-1', productName: 'Item A', quantity: 10, unitPrice: 100, discountAmount: 50, taxRate: 0 },
          { productId: 'prod-2', productName: 'Item B', quantity: 2, unitPrice: 200, discountAmount: 0, taxRate: 10 },
        ],
      };

      const result = await service.createSalesOrderWithItems('org-id', payload, 'rep-1');

      expect(result).toBeDefined();
      expect(result.grossAmount).toBe(1400); // 10*100 + 2*200 = 1000 + 400 = 1400
      expect(result.discountAmount).toBe(50);
      expect(result.taxAmount).toBe(40); // 10% of 400 = 40
      expect(result.netAmount).toBe(1390); // 1400 - 50 + 40 = 1390
      expect(retailers.save).toHaveBeenCalledWith(
        expect.objectContaining({ outstandingBalance: 2390 }), // 1000 + 1390
      );
      expect(governance.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'CREATE', entityName: 'SfaDms:orders' }),
        'org-id',
      );
    });

    it('updates sales order status and deducts distributor stock on Delivered', async () => {
      orders.findOne.mockResolvedValueOnce({
        id: 'order-1',
        organizationId: 'org-id',
        distributorId: 'dist-1',
        status: 'Dispatched',
      });
      orderItems.find.mockResolvedValueOnce([
        { productId: 'prod-1', quantity: 5 },
      ]);
      inventory.findOne.mockResolvedValueOnce({
        distributorId: 'dist-1',
        productId: 'prod-1',
        availableQuantity: 20,
      });

      const updated = await service.updateSalesOrderStatus('org-id', 'order-1', 'Delivered', 'user-1');

      expect(updated.status).toBe('Delivered');
      expect(inventory.save).toHaveBeenCalledWith(
        expect.objectContaining({ availableQuantity: 15 }),
      );
    });

    it('rejects invalid order status transition', async () => {
      orders.findOne.mockResolvedValueOnce({ id: 'order-1', organizationId: 'org-id', status: 'Draft' });
      await expect(
        service.updateSalesOrderStatus('org-id', 'order-1', 'InvalidStatus', 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('Primary Orders (Company -> Distributor)', () => {
    it('creates primary indent and increments distributor inventory upon delivery receipt', async () => {
      distributors.findOne.mockResolvedValueOnce({
        id: 'dist-1',
        organizationId: 'org-id',
        warehouseId: 'wh-1',
      });

      const order = await service.createPrimaryOrderWithItems(
        'org-id',
        {
          distributorId: 'dist-1',
          orderDate: '2026-09-21',
          items: [{ productId: 'prod-1', quantity: 50, unitPrice: 80, discountAmount: 0 }],
        },
        'user-1',
      );

      expect(order.netAmount).toBe(4000);

      // Transition to Received
      primaryOrders.findOne.mockResolvedValueOnce({
        id: 'po-1',
        organizationId: 'org-id',
        distributorId: 'dist-1',
        status: 'Dispatched',
      });
      primaryOrderItems.find.mockResolvedValueOnce([
        { productId: 'prod-1', productName: 'Prod A', quantity: 50, unitPrice: 80 },
      ]);
      inventory.findOne.mockResolvedValueOnce(null); // No existing inventory, should create

      await service.updatePrimaryOrderStatus('org-id', 'po-1', 'Received', 'user-1');

      expect(inventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          distributorId: 'dist-1',
          productId: 'prod-1',
          availableQuantity: 50,
        }),
      );
    });
  });

  describe('Distributor Onboarding', () => {
    it('updates onboarding status and sets active flag accordingly', async () => {
      distributors.findOne.mockResolvedValueOnce({ id: 'dist-1', organizationId: 'org-id', onboardingStatus: 'Draft' });

      const approved = await service.updateDistributorOnboarding('org-id', 'dist-1', 'Approved', undefined, 'admin-1');
      expect(approved.onboardingStatus).toBe('Approved');
      expect(approved.active).toBe(true);

      distributors.findOne.mockResolvedValueOnce({ id: 'dist-1', organizationId: 'org-id', onboardingStatus: 'Approved' });
      const blocked = await service.updateDistributorOnboarding('org-id', 'dist-1', 'Blocked', 'Credit Default', 'admin-1');
      expect(blocked.onboardingStatus).toBe('Blocked');
      expect(blocked.active).toBe(false);
      expect(blocked.blockedReason).toBe('Credit Default');
    });
  });

  describe('Collections Verification', () => {
    it('reduces retailer outstanding balance when collection is verified', async () => {
      collections.findOne.mockResolvedValueOnce({
        id: 'col-1',
        organizationId: 'org-id',
        retailerId: 'ret-1',
        amount: 500,
        status: 'Submitted',
      });
      retailers.findOne.mockResolvedValueOnce({
        id: 'ret-1',
        organizationId: 'org-id',
        outstandingBalance: 2000,
      });

      const verified = await service.verifyCollection('org-id', 'col-1', 'Verified', '2026-09-22', 'acc-1');

      expect(verified.status).toBe('Verified');
      expect(retailers.save).toHaveBeenCalledWith(
        expect.objectContaining({ outstandingBalance: 1500 }),
      );
    });
  });

  describe('Field Attendance & Visits', () => {
    it('records rep attendance check-in and check-out', async () => {
      attendance.findOne.mockResolvedValueOnce(null);
      const checkIn = await service.checkInAttendance('org-id', 'rep-1', 23.8103, 90.4125);
      expect(checkIn).toBeDefined();

      attendance.findOne.mockResolvedValueOnce({
        organizationId: 'org-id',
        salesRepId: 'rep-1',
        date: '2026-09-21',
      });
      const checkOut = await service.checkOutAttendance('org-id', 'rep-1', 23.8105, 90.4128, undefined, 'Daily visit finished');
      expect(checkOut.remarks).toBe('Daily visit finished');
    });

    it('completes field visit with outcome and amounts', async () => {
      visits.findOne.mockResolvedValueOnce({
        id: 'v-1',
        organizationId: 'org-id',
        salesRepId: 'rep-1',
        visitDate: '2026-09-21',
        status: 'In Progress',
      });
      attendance.findOne.mockResolvedValueOnce({
        organizationId: 'org-id',
        salesRepId: 'rep-1',
        totalVisits: 2,
      });

      const completed = await service.checkOutFieldVisit(
        'org-id',
        'v-1',
        { outcome: 'Order Placed', orderAmount: 5000, collectionAmount: 2000, note: 'Order collected' },
        'rep-1',
      );

      expect(completed.status).toBe('Completed');
      expect(completed.outcome).toBe('Order Placed');
      expect(attendance.save).toHaveBeenCalledWith(
        expect.objectContaining({ totalVisits: 3 }),
      );
    });
  });
});

