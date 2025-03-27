import { Injectable } from '@nestjs/common';
import { CreateDeliveryPartnerDto } from './dto/create-delivery-partner.dto';
import { UpdateDeliveryPartnerDto } from './dto/update-delivery-partner.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryPartner } from './entities/delivery-partner.entity';
import paginationHelpers from 'src/helpers/paginationHelpers';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class DeliveryPartnerService {
  constructor(
    @InjectRepository(DeliveryPartner)
    private readonly deliveryPartnerRepository: Repository<DeliveryPartner>,
  ) {}
  async create(createDeliveryPartnerDto: CreateDeliveryPartnerDto) {
    const result = await this.deliveryPartnerRepository.save(
      createDeliveryPartnerDto,
    );

    return result
  }

   async getPartner(options,filterOptions,organizationId) {
      const {page,limit,skip,sortBy,sortOrder}=   paginationHelpers(options)
      const queryBuilder = this.deliveryPartnerRepository.createQueryBuilder('partner')
      .where('partner.organizationId = :organizationId', { organizationId })
      .take(limit)
      .skip(skip)
      .orderBy(`partner.${sortBy}`, sortOrder);
  
     
         // Search
         if (filterOptions?.searchTerm) {
             const searchTerm = `%${filterOptions.searchTerm}%`;
             queryBuilder.andWhere(
                 '(partner.contactPerson LIKE :searchTerm OR partner.partnerName LIKE :searchTerm)',
                 { searchTerm }
             );
         }
     

         // Execute query
         const [data, total] = await queryBuilder.getManyAndCount();
         const modifyData = plainToInstance(DeliveryPartner, data);
         return {
             data: modifyData,
             total,
             page,
             limit,
         };
   }

  findOne(id: number) {
    return `This action returns a #${id} deliveryPartner`;
  }

  async update(id: string,data:Partial<DeliveryPartner>) {
    const result= await this.deliveryPartnerRepository.update({id},data);
    console.log(result);
    if(result?.affected>0){
      return await this.deliveryPartnerRepository.findOne({where:{id}})
    }
    else{
      return null
    }
  }
  remove(id: number) {
    return `This action removes a #${id} deliveryPartner`;
  }
  async loadOptions(organizationId: string) {
    console.log(organizationId);
    const options = await this.deliveryPartnerRepository
      .createQueryBuilder('partner')
      .where('partner.organizationId = :organizationId', { organizationId })
      .andWhere('partner.active = :active', { active: true }) 
      .select(['partner.id AS value', 'partner.partnerName AS label']) 
      .getRawMany();
  
    return options;
  }
  
}
