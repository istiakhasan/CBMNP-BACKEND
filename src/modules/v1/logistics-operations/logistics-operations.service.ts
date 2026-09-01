import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CourierRoutingRule } from './entities/courier-routing-rule.entity';
import { ShippingRateMatrix } from './entities/shipping-rate-matrix.entity';
import { WarehousePickList, PickListStatus } from './entities/warehouse-pick-list.entity';
import { PickListItem } from './entities/pick-list-item.entity';
import { CourierSettlement, SettlementStatus } from './entities/courier-settlement.entity';
import { Order } from '../order/entities/order.entity';
import { Products as OrderProduct } from '../order/entities/products.entity';
import { DeliveryPartner } from '../delivery-partner/entities/delivery-partner.entity';

@Injectable()
export class LogisticsOperationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CourierRoutingRule)
    private readonly routingRuleRepo: Repository<CourierRoutingRule>,
    @InjectRepository(ShippingRateMatrix)
    private readonly rateMatrixRepo: Repository<ShippingRateMatrix>,
    @InjectRepository(WarehousePickList)
    private readonly pickListRepo: Repository<WarehousePickList>,
    @InjectRepository(PickListItem)
    private readonly pickListItemRepo: Repository<PickListItem>,
    @InjectRepository(CourierSettlement)
    private readonly settlementRepo: Repository<CourierSettlement>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderProduct)
    private readonly orderProductRepo: Repository<OrderProduct>,
    @InjectRepository(DeliveryPartner)
    private readonly deliveryPartnerRepo: Repository<DeliveryPartner>,
  ) {}

  // ================= COURIER ROUTING RULES =================
  async createRoutingRule(data: Partial<CourierRoutingRule>, organizationId: string): Promise<CourierRoutingRule> {
    const rule = this.routingRuleRepo.create({ ...data, organizationId });
    return this.routingRuleRepo.save(rule);
  }

  async getRoutingRules(organizationId: string): Promise<CourierRoutingRule[]> {
    return this.routingRuleRepo.find({
      where: { organizationId },
      order: { priority: 'ASC' },
      relations: ['courierPartner'],
    });
  }

  // ================= SHIPPING RATE MATRIX =================
  async setRateMatrix(data: Partial<ShippingRateMatrix>, organizationId: string): Promise<ShippingRateMatrix> {
    let matrix = await this.rateMatrixRepo.findOne({
      where: { organizationId, courierPartnerId: data.courierPartnerId, zoneType: data.zoneType },
    });

    if (matrix) {
      Object.assign(matrix, data);
    } else {
      matrix = this.rateMatrixRepo.create({ ...data, organizationId });
    }
    return this.rateMatrixRepo.save(matrix);
  }

  async getRateMatrices(organizationId: string): Promise<ShippingRateMatrix[]> {
    return this.rateMatrixRepo.find({
      where: { organizationId },
      relations: ['courierPartner'],
    });
  }

  // ================= WAREHOUSE PICK LISTS =================
  async generatePickList(orderIds: string[], warehouseId: string, organizationId: string, pickerId?: string): Promise<WarehousePickList> {
    if (!orderIds || orderIds.length === 0) {
      throw new BadRequestException('At least one order ID must be selected to generate a pick list');
    }

    const orderProducts = await this.orderProductRepo.find({
      where: { order: { orderNumber: In(orderIds) } } as any,
      relations: ['product', 'order'],
    });

    // Aggregate quantities by product
    const productQtyMap = new Map<string, number>();
    orderProducts.forEach((op) => {
      const current = productQtyMap.get(op.productId) || 0;
      productQtyMap.set(op.productId, current + Number(op.productQuantity || 1));
    });

    return this.dataSource.transaction(async (manager) => {
      const year = new Date().getFullYear();
      const pickListNumber = `PL-${year}-${Date.now().toString().slice(-6)}`;

      const pickList = manager.create(WarehousePickList, {
        pickListNumber,
        pickDate: new Date().toISOString().split('T')[0],
        warehouseId,
        orderIds,
        status: PickListStatus.GENERATED,
        assignedPickerId: pickerId,
        organizationId,
      });

      const savedPL = await manager.save(pickList);

      const items: PickListItem[] = [];
      productQtyMap.forEach((qty, prodId) => {
        const item = manager.create(PickListItem, {
          pickListId: savedPL.id,
          productId: prodId,
          totalQuantityToPick: qty,
          pickedQuantity: 0,
          organizationId,
        });
        items.push(item);
      });

      await manager.save(PickListItem, items);

      savedPL.items = items;
      return savedPL;
    });
  }

  async getPickLists(organizationId: string) {
    return this.pickListRepo.find({
      where: { organizationId },
      order: { pickDate: 'DESC' },
      relations: ['warehouse', 'items', 'items.product'],
    });
  }

  // ================= COURIER COD RECONCILIATION =================
  async reconcileSettlement(data: any, organizationId: string): Promise<CourierSettlement> {
    const year = new Date().getFullYear();
    const settlementNumber = `SETTLE-${year}-${Date.now().toString().slice(-6)}`;

    const totalCollected = Number(data.totalCodCollected || 0);
    const deliveryCharges = Number(data.totalDeliveryCharges || 0);
    const netDisbursed = Number(data.netDisbursedAmount || 0);
    const expected = totalCollected - deliveryCharges;
    const variance = netDisbursed - expected;

    const settlement = this.settlementRepo.create({
      settlementNumber,
      settlementDate: data.settlementDate || new Date().toISOString().split('T')[0],
      courierPartnerId: data.courierPartnerId,
      totalCodCollected: totalCollected,
      totalDeliveryCharges: deliveryCharges,
      netDisbursedAmount: netDisbursed,
      systemExpectedAmount: expected,
      variance,
      status: Math.abs(variance) < 1 ? SettlementStatus.RECONCILED : SettlementStatus.DISCREPANCY,
      bankDepositReference: data.bankDepositReference,
      notes: data.notes,
      organizationId,
    });

    return this.settlementRepo.save(settlement);
  }

  async getSettlements(
    organizationId: string,
    partnerId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const qb = this.settlementRepo
      .createQueryBuilder('settlement')
      .leftJoinAndSelect('settlement.courierPartner', 'courierPartner')
      .where('settlement.organizationId = :organizationId', { organizationId });

    if (partnerId) {
      qb.andWhere('settlement.courierPartnerId = :partnerId', { partnerId });
    }

    if (startDate && endDate) {
      qb.andWhere(
        'settlement.settlementDate >= :startDate AND settlement.settlementDate <= :endDate',
        { startDate, endDate },
      );
    }

    return qb.orderBy('settlement.settlementDate', 'DESC').getMany();
  }
}
