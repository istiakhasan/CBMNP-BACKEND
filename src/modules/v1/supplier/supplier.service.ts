import { Injectable } from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { Repository } from 'typeorm';

@Injectable()
export class SupplierService {
    constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository:Repository<Supplier>
    ){}
   async create(createSupplierDto: Supplier) {
    console.log(createSupplierDto);
    const result =await this.supplierRepository.save(createSupplierDto)
    return result
  }


  async loadOptions(organizationId) {
    const options = await this.supplierRepository.find({
      where:{organizationId}
    })
  
    return options;
  }

  findAll() {
    return `This action returns all supplier`;
  }

  findOne(id: number) {
    return `This action returns a #${id} supplier`;
  }

  update(id: number, updateSupplierDto: UpdateSupplierDto) {
    return `This action updates a #${id} supplier`;
  }

  remove(id: number) {
    return `This action removes a #${id} supplier`;
  }
}
