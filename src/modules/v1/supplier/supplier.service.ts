import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { Repository } from 'typeorm';
import paginationHelpers from 'src/helpers/paginationHelpers';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}
  async create(createSupplierDto: Supplier) {
    const result = await this.supplierRepository.save(createSupplierDto);
    return result;
  }

    async getAllSupplier(options, filterOptions, organizationId) {
    const { page, limit, sortBy, sortOrder, skip } = paginationHelpers(options);
    const queryBuilder = this.supplierRepository
      .createQueryBuilder('supplier')
      .where('supplier.organizationId = :organizationId', { organizationId });



        if (filterOptions?.searchTerm) {
      const searchTerm = `%${filterOptions.searchTerm.toLowerCase()}%`;

      queryBuilder.andWhere(
        '(LOWER(supplier.company) LIKE :searchTerm OR LOWER(supplier.phone) LIKE :searchTerm OR LOWER(supplier.contactPerson) LIKE :searchTerm)',
        { searchTerm },
      );
    }

    queryBuilder.orderBy(`supplier.${sortBy}`, sortOrder).skip(skip).take(limit);

    const [orders, total] = await queryBuilder.getManyAndCount();

    return {
      data: orders,
      total,
      page,
      limit,
    };
  }
  async loadOptions(organizationId) {
    const options = await this.supplierRepository.find({
      where: { organizationId },
    });

    return options;
  }

  findAll() {
    return `This action returns all supplier`;
  }

  findOne(id: number) {
    return `This action returns a #${id} supplier`;
  }

  async update(id: string, updateUserDto: Partial<Supplier>) {
    const user = await this.supplierRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }
    await this.supplierRepository.update({ id }, updateUserDto);

    return this.supplierRepository.findOne({
      where: { id },
    });
  }

  remove(id: number) {
    return `This action removes a #${id} supplier`;
  }
}
