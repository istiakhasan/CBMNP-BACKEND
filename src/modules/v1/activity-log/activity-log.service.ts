import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { ActivityLogQueryDto } from './dto/activity-log-query.dto';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
  ) {}

  async create(
    data: CreateActivityLogDto & Partial<ActivityLog>,
    organizationId: string,
  ): Promise<ActivityLog> {
    const log = this.activityLogRepo.create({ ...data, organizationId });
    return this.activityLogRepo.save(log);
  }

  async recordActivity(data: Partial<ActivityLog>): Promise<ActivityLog | null> {
    if (!data.organizationId || !data.module || !data.action) return null;

    const log = this.activityLogRepo.create(data);
    return this.activityLogRepo.save(log);
  }

  async findAll(query: ActivityLogQueryDto, organizationId: string) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);

    const qb = this.activityLogRepo
      .createQueryBuilder('log')
      .where('log.organizationId = :organizationId', { organizationId })
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.module) qb.andWhere('log.module = :module', { module: query.module });
    if (query.action) qb.andWhere('log.action = :action', { action: query.action });
    if (query.userId) qb.andWhere('log.userId = :userId', { userId: query.userId });
    if (query.startDate) qb.andWhere('log.createdAt >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('log.createdAt <= :endDate', { endDate: query.endDate });
    if (query.search) {
      qb.andWhere(
        '(log.description ILIKE :search OR log.module ILIKE :search OR log.action ILIKE :search OR log.path ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}
