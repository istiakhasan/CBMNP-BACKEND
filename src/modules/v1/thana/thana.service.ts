import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Thana } from './entities/thana.entity';
import { Repository } from 'typeorm';
import { DistrictsService } from '../districts/districts.service';
import { seedData } from './thanaData';

@Injectable()
export class ThanaService {
  constructor(
    @InjectRepository(Thana)
    private readonly thanaRepository: Repository<Thana>,
    private readonly districtsService: DistrictsService,
  ) {}
  async create(createThanaDto: any) {
    const district = await this.districtsService.findOne(
      createThanaDto.district_id,
    );
    const thana:any = await this.thanaRepository.create(createThanaDto);
    thana.district = district;
    return await this.thanaRepository.save(thana);
  }

  async findAll() {
    return (
      await this.thanaRepository.find({
        relations: ['district'],
      })
    ).sort();
  }

  async findOne(id: number) {
    return await this.thanaRepository.findOne({
      where: { id },
      relations: ['district'],
    });
  }

  async update(id: number, updateThanaDto: any) {
    const thana_id = await this.findOne(id);
    if (!thana_id) {
      throw new NotFoundException();
    }
    Object.assign(thana_id, updateThanaDto);
    if (updateThanaDto.district_id) {
      thana_id.district = await this.districtsService.findOne(
        updateThanaDto.district_id,
      );
    }
    return await this.thanaRepository.save(thana_id);
  }

  async remove(id: number) {
    const thana_id = await this.findOne(id);
    if (!thana_id) {
      throw new NotFoundException();
    }
    return await this.thanaRepository.remove(thana_id);
  }

  async seedDataIfNotExists() {
    const existingDistricts = await this.thanaRepository.find();
    if (existingDistricts.length === 0) {
      for (const seed of seedData) {
        const district = await this.districtsService.findOne(seed.districtId);
        const thana = this.thanaRepository.create({
          name_bn: seed.name_bn,
          name_en: seed.name_en,
          district,
        });
        await this.thanaRepository.save(thana);
      }
    }
  }
}
