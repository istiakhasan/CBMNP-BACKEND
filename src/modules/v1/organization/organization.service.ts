import { Injectable } from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { Repository } from 'typeorm';

@Injectable()
export class OrganizationService {
   constructor(
      @InjectRepository(Organization)
      private readonly organizationRepository: Repository<Organization>,
    ) {}
 async create(data: CreateOrganizationDto) {
    
    return await this.organizationRepository.save(data)
  }

  async findAll() {
   
    return `This action returns all organization`;
  }

  async findOne(id: string) {
    const result=await this.organizationRepository.findOne({where:{id:id}})
    return result
  }

  update(id: number, updateOrganizationDto: UpdateOrganizationDto) {
    return `This action updates a #${id} organization`;
  }

  remove(id: number) {
    return `This action removes a #${id} organization`;
  }
}
