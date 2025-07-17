import { Injectable } from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Repository } from 'typeorm';
import { Customers } from '../customers/entities/customers.entity';
import { Users } from '../user/entities/user.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Customers)
    private readonly customerRepository: Repository<Customers>,
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
  ) {}
  create(createDashboardDto: CreateDashboardDto) {
    return 'This action adds a new dashboard';
  }

  findAll() {
    return `This action returns all dashboard`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dashboard`;
  }

  update(id: number, updateDashboardDto: UpdateDashboardDto) {
    return `This action updates a #${id} dashboard`;
  }

  remove(id: number) {
    return `This action removes a #${id} dashboard`;
  }

  async getMonthlyDashboardData(year: number = new Date().getFullYear(), organizationId?: string) {
  const qb = this.orderRepository
    .createQueryBuilder('order')
    .select([
      "TO_CHAR(order.createdAt, 'Mon') AS month",
      "TO_CHAR(order.createdAt, 'MM') AS monthNumber",
      'COUNT(order.id) as totalOrders',
      'SUM(order.totalPrice) as totalRevenue',
    ])
    .where("EXTRACT(YEAR FROM order.createdAt) = :year", { year })
    .groupBy("month, monthNumber")
    .orderBy("TO_CHAR(order.createdAt, 'MM')::int");

  if (organizationId) {
    qb.andWhere('order.organizationId = :organizationId', { organizationId });
  }

  const results = await qb.getRawMany();

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const chartData = months.map((month) => {
    const found = results.find((r) => r.month === month);
    console.log(found?.totalrevenue,"rev");
    return !!found ? (Number(found?.totalrevenue || 0)): 0;
  });
  return chartData;
}
  async getDashboardSummary(organizationId?: string) {
    console.log(organizationId,"organization id");
     const totalClient=await  this.customerRepository.createQueryBuilder('customers')
          .where('customers.organizationId = :organizationId',{organizationId})
          .select('COALESCE(COUNT(customers.id), 0)', 'count')
          .getRawOne();
     const totalAgent=await  this.userRepository.createQueryBuilder('users')
          .where('users.organizationId = :organizationId',{organizationId})
          .where('users.role = :role',{role:'user'})
          .select('COALESCE(COUNT(users.id), 0)', 'count')
          .getRawOne();

          return {
            totalClient:totalClient.count,
            totalAgent:totalAgent.count,
          }
          console.log(totalClient,"total customer",totalAgent);
  
  }

}
