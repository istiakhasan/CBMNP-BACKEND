import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { District } from './entities/district.entity';
import { Repository } from 'typeorm';
import { DivisionsService } from '../divisions/divisions.service';
import { seedData } from './districtData';

@Injectable()
export class DistrictsService {
  constructor(
    @InjectRepository(District)
    private readonly districtRepository: Repository<District>,
    private readonly divisionsService: DivisionsService,
  ) {}

  async create(createDistrictDto: any) {
    const division = await this.divisionsService.findOne(
      createDistrictDto.division_id,
    );

    const district:any = this.districtRepository.create(createDistrictDto);
    district.division = division;
    return await this.districtRepository.save(district);
  }

  async findAll() {
    return (
      await this.districtRepository.find({
        relations: ['thana_info', 'division'],
      })
    ).sort();
  }

  async findOne(id: number) {
    return await this.districtRepository.findOne({
      where: { id },
      relations: ['thana_info', 'division'],
    });
  }

  async update(id: number, updateDistrictDto: any) {
    const district_id = await this.findOne(id);
    if (!district_id) {
      throw new NotFoundException();
    }
    Object.assign(district_id, updateDistrictDto);

    if (updateDistrictDto.division_id) {
      district_id.division = await this.divisionsService.findOne(
        updateDistrictDto.division_id,
      );
    }
    return await this.districtRepository.save(district_id);
  }

  async remove(id: number) {
    const district_id = await this.findOne(id);
    if (!district_id) {
      throw new NotFoundException();
    }
    return await this.districtRepository.remove(district_id);
  }

  async seedDataIfNotExists() {
    const existingDistricts = await this.districtRepository.find();
    if (existingDistricts.length === 0) {
      for (const seed of seedData) {
        const division = await this.divisionsService.findOne(seed.divisionId);
        const district = this.districtRepository.create({
          name_bn: seed.name_bn,
          name_en: seed.name_en,
          division,
        });
        await this.districtRepository.save(district);
      }
    }
  }
}
