import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Comments } from './entities/orderComment.entity';
import { Order } from '../order/entities/order.entity';
import { ApiError } from '../../../middleware/ApiError';
@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comments) private readonly commentRepository: Repository<Comments>,  
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,  
  ) {}

  async createComment(payload: Comments) {
    const isExist=await this.orderRepository.findOne({where:{id:payload.orderId}})
    if(!isExist){
      throw new ApiError(HttpStatus.BAD_REQUEST,'Order is not exist')
    }
   console.log(isExist,payload);
    const result=await this.commentRepository.save(payload)
    return result
  }
  




 
  
}
