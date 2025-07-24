import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Division } from './entities/division.entity';
import { Repository } from 'typeorm';

@Injectable()
export class DivisionsService {
  constructor(
    @InjectRepository(Division)
    private readonly divisionRepository: Repository<Division>,
  ) {}

  async create(createDivisionDto: any) {
    const division = this.divisionRepository.create(createDivisionDto);
    return await this.divisionRepository.save(division);
  }

  async findAll() {
    return (
      await this.divisionRepository.find({
        relations: ['district_info'],
        // order: {
        //   id: 'DESC',
        // },
      })
    ).sort();
  }

  async findOne(id: number) {
    return await this.divisionRepository.findOne({
      where: { id },
      relations: ['district_info'],
    });
  }

  async update(id: number, updateDivisionDto: any) {
    const division_id = await this.findOne(id);
    if (!division_id) {
      throw new NotFoundException();
    }
    Object.assign(division_id, updateDivisionDto);
    return await this.divisionRepository.save(division_id);
  }

  async remove(id: number) {
    const division_id = await this.findOne(id);
    if (!division_id) {
      throw new NotFoundException();
    }
    return await this.divisionRepository.remove(division_id);
  }

  async seedDataIfNotExists() {
    const divisions = await this.divisionRepository.find();
    if (divisions.length === 0) {
      const seedData = [
        { name_bn: 'ঢাকা', name_en: 'Dhaka' },
        { name_bn: 'চট্টগ্রাম', name_en: 'Chittagong' },
        { name_bn: 'রাজশাহী', name_en: 'Rajshahi' },
        { name_bn: 'খুলনা', name_en: 'Khulna' },
        { name_bn: 'বরিশাল', name_en: 'Barisal' },
        { name_bn: 'সিলেট', name_en: 'Sylhet' },
        { name_bn: 'রংপুর', name_en: 'Rangpur' },
        { name_bn: 'ময়মনসিংহ', name_en: 'Mymensingh' },
      ];
      await this.divisionRepository.save(seedData);
    }
  }
}
