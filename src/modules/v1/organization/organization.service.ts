import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { Repository } from 'typeorm';
import paginationHelpers from 'src/helpers/paginationHelpers';

@Injectable()
export class OrganizationService {
   constructor(
      @InjectRepository(Organization)
      private readonly organizationRepository: Repository<Organization>,
    ) {}
 async create(data: Organization) {
    
    return await this.organizationRepository.save(data)
  }

  async findAll(options,filterOptions) {
    const {page,limit,skip,sortBy,sortOrder}=paginationHelpers(options)
    const queryBuildere=this.organizationRepository.createQueryBuilder('organization')
    .take(limit)
    .skip(skip)
    .orderBy(`organization.${sortBy}`,sortOrder)


    if(filterOptions?.searchTerm){
    const searchTerm= `%${filterOptions.searchTerm.toLowerCase()}%`
    queryBuildere.andWhere('(LOWER(organization.name) LIKE :searchTerm)',{searchTerm})
    }

    const [organizations,total]= await queryBuildere.getManyAndCount()
    return  {
      data:organizations,
      total,
      page,
      limit
    }
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
