import { HttpStatus, Injectable } from '@nestjs/common';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { Warehouse } from './entities/warehouse.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiError } from '../../../middleware/ApiError';;
import paginationHelpers from '../../../helpers/paginationHelpers';
import { plainToInstance } from 'class-transformer';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';

@Injectable()
export class WarehouseService {
  constructor(
  @InjectRepository(Warehouse)
  private readonly warehouse:Repository<Warehouse>,
  @InjectRepository(InventoryItem)
  private readonly inventoryItemRepository: Repository<InventoryItem>,
  ){}
  async create(createWarehouseDto: Warehouse) {
    const isExist=await this.warehouse.findOne({where:{name:createWarehouseDto.name}})
    if(isExist){
      throw new ApiError(HttpStatus.BAD_REQUEST,'Name already exist')
    }
    return await this.warehouse.save(createWarehouseDto)
  }

  async findAll(options,filterOptions,organizationId) {
    const {page,limit,skip,sortBy,sortOrder}=paginationHelpers(options)
    const queryBuilder=this.warehouse.createQueryBuilder('warehouse')
    .where('warehouse.organizationId = :organizationId', { organizationId })
    .take(limit)
    .skip(skip)
    .orderBy(`warehouse.${sortBy}`,sortOrder)
   if (filterOptions?.searchTerm) {
    const searchTerm = `%${filterOptions.searchTerm}%`;
    queryBuilder.andWhere(
      'LOWER(warehouse.name) LIKE LOWER(:searchTerm)',
      { searchTerm },
    );
  }

    const [data, total] = await queryBuilder.getManyAndCount();
    const modifyData = plainToInstance(Warehouse, data);
    return {
      data:modifyData,
      total,
      page,
      limit
    }
  }

  async loadOptions(organizationId) {
    const options = await this.warehouse
      .createQueryBuilder('warehouse')
      .where('warehouse.organizationId = :organizationId', { organizationId })
      .select(['warehouse.id AS value', 'warehouse.name AS label','warehouse.isDefault AS "isDefault"']) 
      .getRawMany();
  
    return options;
  }
  async getOverview(organizationId: string) {
    const rows = await this.warehouse
      .createQueryBuilder('warehouse')
      .leftJoin(InventoryItem, 'stock', 'stock.locationId = warehouse.id')
      .where('warehouse.organizationId = :organizationId', { organizationId })
      .select('warehouse.id', 'warehouseId')
      .addSelect('warehouse.name', 'warehouseName')
      .addSelect('warehouse.isDefault', 'isDefault')
      .addSelect('COUNT(stock.productId)', 'skuCount')
      .addSelect('COALESCE(SUM(stock.quantity), 0)', 'availableQuantity')
      .addSelect('COALESCE(SUM(stock.orderQue + stock.processing + stock.hoildQue), 0)', 'allocatedQuantity')
      .addSelect('COALESCE(SUM(stock.hoildQue), 0)', 'holdQuantity')
      .addSelect('COALESCE(SUM(stock.expiredQuantity), 0)', 'expiredQuantity')
      .groupBy('warehouse.id')
      .getRawMany();

    const warehouses = rows.map((row) => ({
      warehouseId: row.warehouseId,
      warehouseName: row.warehouseName,
      isDefault: row.isDefault === true || row.isDefault === 'true',
      skuCount: Number(row.skuCount || 0),
      availableQuantity: Number(row.availableQuantity || 0),
      allocatedQuantity: Number(row.allocatedQuantity || 0),
      holdQuantity: Number(row.holdQuantity || 0),
      expiredQuantity: Number(row.expiredQuantity || 0),
    }));
    return {
      totalWarehouses: warehouses.length,
      totalSkus: warehouses.reduce((sum, item) => sum + item.skuCount, 0),
      availableQuantity: warehouses.reduce((sum, item) => sum + item.availableQuantity, 0),
      allocatedQuantity: warehouses.reduce((sum, item) => sum + item.allocatedQuantity, 0),
      holdQuantity: warehouses.reduce((sum, item) => sum + item.holdQuantity, 0),
      expiredQuantity: warehouses.reduce((sum, item) => sum + item.expiredQuantity, 0),
      warehouses,
    };
  }
  findOne(id: number) {
    return `This action returns a #${id} warehouse`;
  }

  async update(id: string, updateWarehouseDto: UpdateWarehouseDto) {
     await this.warehouse.update({id:id},updateWarehouseDto)
     return this.warehouse.findOne({
      where:{id:id}
    });
  }

  remove(id: number) {
    return `This action removes a #${id} warehouse`;
  }

  async setDefault(id: string, organizationId: string) {
  const warehouse = await this.warehouse.findOne({
    where: { id, organizationId },
  });

  if (!warehouse) {
    throw new ApiError(HttpStatus.NOT_FOUND, 'Warehouse not found');
  }

  // transaction diye ensure kora hocche j ekta org e ekbare 1 tai default thake
  await this.warehouse.manager.transaction(async (manager) => {
    await manager.update(
      Warehouse,
      { organizationId, isDefault: true },
      { isDefault: false },
    );

    await manager.update(
      Warehouse,
      { id },
      { isDefault: true },
    );
  });

  return this.warehouse.findOne({ where: { id } });
}
}
