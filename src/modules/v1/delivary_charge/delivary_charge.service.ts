import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { DelivaryCharge } from './entities/delivary_charge.entity';
import { In, Repository } from 'typeorm';
import { seedData } from './delivaryChargeData';
import { Thana } from '../thana/entities/thana.entity';

@Injectable()
export class DelivaryChargeService {
  constructor(
    @InjectRepository(DelivaryCharge)
    private readonly delivaryChargeRepository: Repository<DelivaryCharge>,
    @InjectRepository(Thana)
    private readonly thanaRepository: Repository<Thana>,
  ) {}

  async create(createDelivaryChargeDto: any[]) {
    const deliveryCharges:any = createDelivaryChargeDto.map((dto) =>
      this.delivaryChargeRepository.create(dto),
    );
    return await this.delivaryChargeRepository.save(deliveryCharges);
  }

  async bulkCreate(bulkCreateDto: any[]) {
    if (!Array.isArray(bulkCreateDto) || bulkCreateDto.length === 0) {
      throw new BadRequestException('Invalid or empty input array');
    }

    // Extract thana_ids from request
    const thanaIds = bulkCreateDto.map((dto) => dto.thana_id);

    // Fetch existing thana records to ensure they exist
    const existingThanas = await this.thanaRepository.find({
      where: { id: In(thanaIds) },
    });

    // Create a map for quick lookup
    const thanaMap = new Map(existingThanas.map((thana) => [thana.id, thana]));

    // Separate invalid thana_ids
    const invalidThanaIds = thanaIds.filter((id) => !thanaMap.has(id));

    if (invalidThanaIds.length > 0) {
      throw new BadRequestException(
        `Invalid thana_id(s) found: ${invalidThanaIds.join(', ')}`,
      );
    }

    // Fetch existing delivery charges to check for duplicate thana_ids
    const existingCharges = await this.delivaryChargeRepository.find({
      where: { thana_id: In(thanaIds) },
    });

    const existingChargeIds = existingCharges.map((charge) => charge.thana_id);

    // Filter out DTOs with existing thana_ids in delivery charge
    const newEntries = bulkCreateDto.filter(
      (dto) => !existingChargeIds.includes(dto.thana_id),
    );
    const skippedEntries = bulkCreateDto.filter((dto) =>
      existingChargeIds.includes(dto.thana_id),
    );

    if (newEntries.length === 0) {
      return {
        success: false,
        message: 'All provided thana_ids already exist in delivery charges.',
        skippedThanaIds: existingChargeIds,
        createdCount: 0,
      };
    }

    // Create new delivery charge records
    const deliveryCharges = newEntries.map((dto) => {
      return this.delivaryChargeRepository.create({
        thana: thanaMap.get(dto.thana_id), // Assign the related thana entity
        thana_id: dto.thana_id, // Keep this for reference
        prices: dto.prices,
        expressPrices: dto.expressPrices ?? 0,
      });
    });

    // Save new records
    const savedRecords =
      await this.delivaryChargeRepository.save(deliveryCharges);

    return {
      success: true,
      message: 'Bulk create operation completed',
      createdCount: savedRecords.length,
      createdRecords: savedRecords,
      skippedThanaIds: existingChargeIds,
      skippedMessage:
        skippedEntries.length > 0
          ? `The following thana_ids already exist in delivery charges: ${existingChargeIds.join(', ')}`
          : null,
    };
  }

  async findAll(page?: number, limit?: number) {
    if (!page || !limit) {
      // If no pagination, return all records
      return await this.delivaryChargeRepository.find({
        relations: ['thana'], // Include Thana details
        order: { id: 'asc' },
      });
    }

    // If pagination parameters are provided
    const skip = (page - 1) * limit;

    const [data, total] = await this.delivaryChargeRepository.findAndCount({
      relations: ['thana'], // Include Thana details
      order: { id: 'asc' },
      take: limit,
      skip: skip,
    });

    return {
      data,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const deliveryCharge = await this.delivaryChargeRepository.findOne({
      where: { id },
      relations: ['thana'], // Include Thana details
    });

    if (!deliveryCharge) {
      throw new NotFoundException(`Delivery charge with ID ${id} not found`);
    }
    return deliveryCharge;
  }
  async update(id: number, updateDelivaryChargeDto: any) {
    const delivary_charge_id = await this.findOne(id);
    if (!delivary_charge_id) {
      throw new NotFoundException();
    }
    Object.assign(delivary_charge_id, updateDelivaryChargeDto);

    return await this.delivaryChargeRepository.save(delivary_charge_id);
  }

  async bulkUpdate(bulkUpdateDto: any[]) {
    if (!Array.isArray(bulkUpdateDto) || bulkUpdateDto.length === 0) {
      throw new BadRequestException('Invalid or empty input array');
    }

    // Extract current and new thana_ids
    const thanaIds = bulkUpdateDto.map((dto) => dto.thana_id);
    const newThanaIds = bulkUpdateDto
      .map((dto) => dto.new_thana_id)
      .filter((id) => id !== undefined) as number[];

    // Fetch existing delivery charges
    const existingCharges = await this.delivaryChargeRepository.find({
      where: { thana_id: In(thanaIds) },
      relations: ['thana'], // Ensure thana relation is loaded
    });

    // Create a map of existing delivery charges for quick lookup
    const chargeMap = new Map(
      existingCharges.map((charge) => [charge.thana_id, charge]),
    );

    // Fetch valid thana records
    const validThanas = await this.thanaRepository.find({
      where: { id: In([...thanaIds, ...newThanaIds]) },
    });

    // Create a map for quick lookup of valid thana records
    const thanaMap = new Map(validThanas.map((thana) => [thana.id, thana]));

    // Separate valid and skipped updates
    const validUpdates = bulkUpdateDto.filter((dto) =>
      chargeMap.has(dto.thana_id),
    );
    const skippedUpdates = bulkUpdateDto.filter(
      (dto) => !chargeMap.has(dto.thana_id),
    );

    if (validUpdates.length === 0) {
      return {
        success: false,
        message: 'No valid thana_id(s) found in delivery charges to update.',
        skippedThanaIds: skippedUpdates.map((dto) => dto.thana_id),
        updatedCount: 0,
      };
    }

    // Process valid updates
    const updatedCharges = validUpdates
      .map((dto) => {
        const existingCharge = chargeMap.get(dto.thana_id);

        // If thana_id is being updated, validate and update relation
        if (dto.new_thana_id && dto.new_thana_id !== dto.thana_id) {
          if (!thanaMap.has(dto.new_thana_id)) {
            skippedUpdates.push(dto); // Skip this update
            return null;
          }
          existingCharge.thana_id = dto.new_thana_id; // Update thana_id
          existingCharge.thana = thanaMap.get(dto.new_thana_id); // Update relation
        }

        existingCharge.prices = dto.prices;
        existingCharge.expressPrices =
          dto.expressPrices ?? existingCharge.expressPrices;
        return existingCharge;
      })
      .filter(Boolean); // Remove skipped updates

    // Save the updated records
    const savedRecords =
      await this.delivaryChargeRepository.save(updatedCharges);

    return {
      success: true,
      message: 'Bulk update operation completed',
      updatedCount: savedRecords.length,
      updatedRecords: savedRecords,
      skippedThanaIds: skippedUpdates.map((dto) => dto.thana_id),
      skippedMessage:
        skippedUpdates.length > 0
          ? `The following thana_ids were not found or had invalid new_thana_id: ${skippedUpdates.map((dto) => dto.thana_id).join(', ')}`
          : null,
    };
  }

  async remove(id: number) {
    const delivary_charge_id = await this.findOne(id);
    if (!delivary_charge_id) {
      throw new NotFoundException();
    }
    return await this.delivaryChargeRepository.remove(delivary_charge_id);
  }

  async seedDataIfNotExists() {
    const divisions = await this.delivaryChargeRepository.find();
    if (divisions.length === 0) {
      await this.delivaryChargeRepository.save(seedData);
    }
  }
}
