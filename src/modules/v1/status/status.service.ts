import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Not, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { OrderStatus } from './entities/status.entity';
import { Products } from '../order/entities/products.entity';

@Injectable()
export class StatusService {
  constructor(
    @InjectRepository(OrderStatus)
    private readonly statusRepository: Repository<OrderStatus>,
  ) {}

  async createStatus(data: OrderStatus) {
    const result = await this.statusRepository.save(data);
    return result;
  }

  async getAllStatus(query:{label:string}) {
    let result
    if(query?.label==="Hold"){
        result = await this.statusRepository.findBy({
          label: In(["Approved","Cancel"])
    });
    }
    if(query?.label==="In-transit"){
        result = await this.statusRepository.findBy({
          label: In(["Pending-Return","Delivered"])
    });
    }
    if(query?.label==="Pending-Return"){
        result = await this.statusRepository.findBy({
          label: In([
            "Returned",
            "Partial-Return",
            "Damage"
          ])
    });
    }
    if(query?.label==="Pending"){
        result = await this.statusRepository.findBy({
          label: In(["Hold", "Approved","Cancel"])
    });
    }
    if(query?.label==="Approved"){
        result = await this.statusRepository.findBy({
        // label: Not("Approved")
        label: In(["Store","Hold","Cancel","Unreachable"])
    });
    }
    if(query?.label==="Cancel"){
      return
        result = await this.statusRepository.findBy({
          label: In(["Approved","Pending"])
    });
    }
    if(query?.label==="Store"){
        result = await this.statusRepository.findBy({
          label: In(["Packing", "Hold","Cancel"])
    });
    }
    if(query?.label==="Packing"){
        result = await this.statusRepository.findBy({
          label: In(["In-transit", "Hold","Cancel"])
    });
    }
    if(query?.label==="all"){
        result = await this.statusRepository.find();
    }
    return result;
  }
async getAllOrdersCountByStatus(organizationId: string, filterOptions: any) {
  const queryBuilder = this.statusRepository
    .createQueryBuilder('status')
    .leftJoin('status.orders', 'orders')
    .where('orders.organizationId = :organizationId', { organizationId });

  // Apply filters
  if (filterOptions.statusId?.length) {
    queryBuilder.andWhere('orders.statusId IN (:...statusIds)', {
      statusIds: filterOptions.statusId,
    });
  }

  if (filterOptions.currier?.length) {
    queryBuilder.andWhere('orders.currier IN (:...curriers)', {
      curriers: filterOptions.currier,
    });
  }

  if (filterOptions.locationId?.length) {
    queryBuilder.andWhere('orders.locationId IN (:...locationIds)', {
      locationIds: filterOptions.locationId,
    });
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

  if (filterOptions.searchTerm) {
    queryBuilder.andWhere(`orders.orderNumber ILIKE :searchTerm`, {
      searchTerm: `%${filterOptions.searchTerm}%`,
    });
  }

  // 🔥 Optimized product filter using subquery
  if (filterOptions.productIds?.length) {
    queryBuilder.andWhere(qb => {
      const subQuery = qb.subQuery()
        .select('p.orderId')
        .from(Products, 'p')
        .where('p.productId IN (:...productIds)', { productIds: filterOptions.productIds })
        .getQuery();
      return 'orders.id IN ' + subQuery;
    });
  }

  // Get counts per status
  const statusCounts = await queryBuilder
    .select('status.label', 'label')
    .addSelect('status.value', 'id')
    .addSelect('COUNT(orders.id)', 'count') // no DISTINCT needed due to subquery
    .groupBy('status.value')
    .addGroupBy('status.label')
    .getRawMany();

  // -------- Total Count Query --------
  const totalQuery = this.statusRepository
    .createQueryBuilder('status')
    .leftJoin('status.orders', 'orders')
    .where('orders.organizationId = :organizationId', { organizationId });

  if (filterOptions.statusId?.length) {
    totalQuery.andWhere('orders.statusId IN (:...statusIds)', {
      statusIds: filterOptions.statusId,
    });
  }

  if (filterOptions.currier?.length) {
    totalQuery.andWhere('orders.currier IN (:...curriers)', {
      curriers: filterOptions.currier,
    });
  }

  if (filterOptions.locationId?.length) {
    totalQuery.andWhere('orders.locationId IN (:...locationIds)', {
      locationIds: filterOptions.locationId,
    });
  }

  if (filterOptions?.startDate && filterOptions?.endDate) {
    totalQuery.andWhere(
      'orders.intransitTime BETWEEN :startDate AND :endDate',
      {
        startDate: new Date(filterOptions.startDate),
        endDate: new Date(filterOptions.endDate),
      },
    );
  }

  if (filterOptions.searchTerm) {
    totalQuery.andWhere(`orders.orderNumber ILIKE :searchTerm`, {
      searchTerm: `%${filterOptions.searchTerm}%`,
    });
  }

  // 🔥 Product filter in total count using subquery
  if (filterOptions.productIds?.length) {
    totalQuery.andWhere(qb => {
      const subQuery = qb.subQuery()
        .select('p.orderId')
        .from(Products, 'p')
        .where('p.productId IN (:...productIds)', { productIds: filterOptions.productIds })
        .getQuery();
      return 'orders.id IN ' + subQuery;
    });
  }

  const totalOrders = await totalQuery
    .select('COUNT(orders.id)', 'count')
    .getRawOne();

  return [...statusCounts, { label: 'All', count: totalOrders?.count }];
}



  
}


// async countOrdersByStatus() {
//   // Count PendingBD
//   const pendingBdCount = await this.orderStatusRepository
//     .createQueryBuilder('orderStatus')
//     .leftJoin('orderStatus.orders', 'orders')
//     .where('orderStatus.name = :name', { name: 'Pending' })
//     .andWhere('orders.isBangladesh = true')
//     .select('COALESCE(COUNT(orders.id), 0)', 'count')
//     .getRawOne();

//   // Count PendingNRB
//   const pendingNrbCount = await this.orderStatusRepository
//     .createQueryBuilder('orderStatus')
//     .leftJoin('orderStatus.orders', 'orders')
//     .where('orderStatus.name = :name', { name: 'Pending' })
//     .andWhere('orders.isBangladesh = false')
//     .select('COALESCE(COUNT(orders.id), 0)', 'count')
//     .getRawOne();

//   // Count other statuses
//   const otherStatuses = await this.orderStatusRepository
//     .createQueryBuilder('orderStatus')
//     .leftJoin('orderStatus.orders', 'orders')
//     .select('orderStatus.name', 'status')
//     .addSelect('COALESCE(COUNT(orders.id), 0)', 'count')
//     .andWhere('orderStatus.name != :name', { name: 'Pending' })
//     .groupBy('orderStatus.name')
//     .orderBy('orderStatus.name', 'ASC')
//     .getRawMany();

//   // Count total orders
//   const totalOrders = await this.orderStatusRepository
//     .createQueryBuilder('orderStatus')
//     .leftJoin('orderStatus.orders', 'orders')
//     .select('COALESCE(COUNT(orders.id), 0)', 'count')
//     .getRawOne();

//   // Combine all results
//   return [
//     { status: 'PendingBD', count: Number(pendingBdCount?.count || 0) },
//     { status: 'PendingNRB', count: Number(pendingNrbCount?.count || 0) },
//     ...otherStatuses.map(item => ({ status: item.status, count: Number(item.count) })),
//     { status: 'Total', count: Number(totalOrders?.count || 0) },
//   ];
// }
