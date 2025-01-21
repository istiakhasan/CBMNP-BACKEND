import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAuth, UserRole } from './entities/auth.entity';
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserAuth)
    private userRepository: Repository<UserAuth>,
  ) {}

  async generateIncrementalId(role: UserRole): Promise<string> {
    const findLastCustomer = await this.userRepository.findOne({
      where: { role },
      order: { created_at: 'DESC' },
      select: ['userId'],
    });
    const lastCustomerId = findLastCustomer ? parseInt(findLastCustomer.userId) : 10000;
    const incrementedId = lastCustomerId + 1; 
    const finalId = incrementedId.toString();
    return finalId;
  }
}
