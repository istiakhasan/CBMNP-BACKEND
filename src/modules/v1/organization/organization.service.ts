import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { Repository } from 'typeorm';

@Injectable()
export class OrganizationService {
   constructor(
      @InjectRepository(Organization)
      private readonly organizationRepository: Repository<Organization>,
    ) {}
 async create(data: Organization) {
    
    return await this.organizationRepository.save(data)
  }

  async findAll() {
   
    return `This action returns all organization`;
  }

  async findOne(id: string) {
    const result=await this.organizationRepository.findOne({where:{id:id}})
    return result
  }

  update(id: number, updateOrganizationDto: Organization) {
    return `This action updates a #${id} organization`;
  }

  remove(id: number) {
    return `This action removes a #${id} organization`;
  }
}
