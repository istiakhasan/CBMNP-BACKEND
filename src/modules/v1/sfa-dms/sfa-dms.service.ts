import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DmsDistributor, DmsRetailer, DmsSalesOrder, DmsSalesOrderItem, SfaCollection, SfaFieldVisit, SfaRoute, SfaSalesTarget, SfaTerritory } from './entities/sfa-dms.entity';
import { GovernanceService } from '../governance/governance.service';

@Injectable()
export class SfaDmsService {
  private readonly resources: Record<string, Repository<any>>;
  constructor(
    @InjectRepository(SfaTerritory) private readonly territories: Repository<SfaTerritory>,
    @InjectRepository(DmsDistributor) private readonly distributors: Repository<DmsDistributor>,
    @InjectRepository(DmsRetailer) private readonly retailers: Repository<DmsRetailer>,
    @InjectRepository(SfaRoute) private readonly routes: Repository<SfaRoute>,
    @InjectRepository(SfaFieldVisit) private readonly visits: Repository<SfaFieldVisit>,
    @InjectRepository(DmsSalesOrder) private readonly orders: Repository<DmsSalesOrder>,
    @InjectRepository(DmsSalesOrderItem) private readonly orderItems: Repository<DmsSalesOrderItem>,
    @InjectRepository(SfaCollection) private readonly collections: Repository<SfaCollection>,
    @InjectRepository(SfaSalesTarget) private readonly targets: Repository<SfaSalesTarget>,
    private readonly governanceService: GovernanceService,
  ) {
    this.resources = { territories, distributors, retailers, routes, visits, orders, collections, targets };
  }
  private validate(resource: string, data: any) {
    const required: Record<string, string[]> = {
      territories: ['code', 'name'], distributors: ['code', 'name'], retailers: ['code', 'name'], routes: ['code', 'name'],
      visits: ['retailerId', 'visitDate'], orders: ['orderNumber', 'retailerId', 'orderDate'],
      collections: ['retailerId', 'collectionDate', 'amount', 'paymentMethod'], targets: ['salesRepId', 'period', 'salesTarget'],
    };
    const missing = (required[resource] || []).filter((field) => data[field] === undefined || data[field] === null || data[field] === '');
    if (missing.length) throw new BadRequestException(`Missing required fields: ${missing.join(', ')}`);
  }
  private repo(resource: string) {
    const repository = this.resources[resource];
    if (!repository) throw new BadRequestException('Unknown SFA/DMS resource');
    return repository;
  }
  async list(resource: string, organizationId: string, page = 1, limit = 20, searchTerm?: string) {
    const repository = this.repo(resource);
    const qb = repository.createQueryBuilder('item').where('item.organizationId = :organizationId', { organizationId });
    if (searchTerm && ['territories', 'distributors', 'retailers', 'routes'].includes(resource)) {
      qb.andWhere('(item.name ILIKE :searchTerm OR item.code ILIKE :searchTerm)', { searchTerm: `%${searchTerm.trim()}%` });
    }
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const [data, total] = await qb.orderBy('item.createdAt', 'DESC').skip((safePage - 1) * safeLimit).take(safeLimit).getManyAndCount();
    return { data, total, page: safePage, limit: safeLimit };
  }
  async create(resource: string, organizationId: string, data: any, userId?: string) {
    const repository = this.repo(resource);
    this.validate(resource, data);
    const payload = { ...data, organizationId };
    if (resource === 'visits' && !payload.salesRepId) payload.salesRepId = userId;
    if (resource === 'orders' && !payload.salesRepId) payload.salesRepId = userId;
    if (resource === 'collections' && !payload.salesRepId) payload.salesRepId = userId;
    const saved = await repository.save(repository.create(payload));
    await this.governanceService.logAction({ entityName: `SfaDms:${resource}`, entityId: saved.id, actionType: 'CREATE', newValues: saved, userId }, organizationId);
    return saved;
  }
  async update(resource: string, id: string, organizationId: string, data: any, userId?: string) {
    const repository = this.repo(resource);
    const existing = await repository.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('SFA/DMS record not found');
    const saved = await repository.save(repository.merge(existing, data));
    await this.governanceService.logAction({ entityName: `SfaDms:${resource}`, entityId: saved.id, actionType: 'UPDATE', previousValues: existing, newValues: saved, userId }, organizationId);
    return saved;
  }
  async dashboard(organizationId: string) {
    const [territories, distributors, retailers, routes, visitsToday, ordersToday, collectionsToday, pendingOrders] = await Promise.all([
      this.territories.count({ where: { organizationId, active: true } }),
      this.distributors.count({ where: { organizationId, active: true } }),
      this.retailers.count({ where: { organizationId, active: true } }),
      this.routes.count({ where: { organizationId, active: true } }),
      this.visits.count({ where: { organizationId, visitDate: new Date().toISOString().slice(0, 10) } }),
      this.orders.count({ where: { organizationId, orderDate: new Date().toISOString().slice(0, 10) } }),
      this.collections.createQueryBuilder('collection').where('collection.organizationId = :organizationId', { organizationId }).andWhere('collection.collectionDate = :today', { today: new Date().toISOString().slice(0, 10) }).select('COALESCE(SUM(collection.amount), 0)', 'amount').getRawOne(),
      this.orders.count({ where: { organizationId, status: 'Submitted' } }),
    ]);
    return { territories, distributors, retailers, routes, visitsToday, ordersToday, collectionToday: Number(collectionsToday?.amount || 0), pendingOrders };
  }
}
