import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Not, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { OrderStatus } from './entities/status.entity';

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
    if(query?.label==="Pending"){
        result = await this.statusRepository.findBy({
          label: In(["Hold", "Approved","Cancel"])
    });
    }
    if(query?.label==="Approved"){
        result = await this.statusRepository.findBy({
          label: Not("Approved")
    });
    }
    if(query?.label==="Cancel"){
        result = await this.statusRepository.findBy({
          label: In(["Hold", "Approved","Pending"])
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
  async getAllOrdersCountByStatus(organizationId) {
    const queryRunner = await this.statusRepository
      .createQueryBuilder('status')
      .leftJoin('status.orders', 'orders')
      .where('orders.organizationId = :organizationId',{organizationId})
      .select('status.label', 'label')
      .addSelect('COALESCE(COUNT(orders.id), 0)', 'count')
      .groupBy('status.value') 
      .addGroupBy('status.label')
      .getRawMany();
      const totalOrders = await this.statusRepository
    .createQueryBuilder('status')
    .leftJoin('status.orders', 'orders')
    .where('orders.organizationId = :organizationId',{organizationId})
    .select('COALESCE(COUNT(orders.id), 0)', 'count')
    .getRawOne();
  
    return [...queryRunner,{label:"All",count:totalOrders?.count}];
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
