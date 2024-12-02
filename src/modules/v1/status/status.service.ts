import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
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

  //   get all customers

  async getAllStatus() {
    const result = await this.statusRepository.find();
    return result;
  }
}
