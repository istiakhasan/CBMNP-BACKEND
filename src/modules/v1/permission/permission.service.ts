import { HttpStatus, Injectable } from '@nestjs/common';
import { Permission } from './entities/permission.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiError } from '../../../middleware/ApiError';
import { v4 as uuidv4 } from 'uuid';
import { permissionData } from '../../../util/permission';
@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}
  async create(createPermissionDto: Permission) {
    console.log(createPermissionDto,"abcd");
    const isexist = await this.permissionRepository.findOne({
      where: {
        label: createPermissionDto.label,
      },
    });
    if (!!isexist) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'Permission label already exist',
      );
    }
    const result = await this.permissionRepository.save(createPermissionDto);
    return result;
  }

  async findAll() {
    const result = await this.permissionRepository.find({
      order: { id: 'ASC' },
    });
    const transformed = Object.values(
      result.reduce((acc, { base, label, id }) => {
        if (!acc[base]) {
          acc[base] = {
            title: base,
            key: uuidv4(),
            children: [],
          };
        }
        acc[base].children.push({
          title: label,
          key: id,
        });
        return acc;
      }, {}),
    );

    return transformed;
  }

  findOne(id: number) {
    return `This action returns a #${id} permission`;
  }

  update(id: number, updatePermissionDto: Permission) {
    return `This action updates a #${id} permission`;
  }

  remove(id: number) {
    return `This action removes a #${id} permission`;
  }

  async seedData() {
    try {
      console.log('🌱 Checking permissions in database...');

      // 1. Synchronize PostgreSQL sequence to prevent duplicate primary key errors
      try {
        await this.permissionRepository.query(`
          DO $$
          DECLARE
            max_id integer;
            seq_name text;
          BEGIN
            SELECT COALESCE(MAX(id), 0) INTO max_id FROM "permission";
            SELECT pg_get_serial_sequence('"permission"', 'id') INTO seq_name;
            IF seq_name IS NOT NULL THEN
              IF max_id = 0 THEN
                PERFORM setval(seq_name, 1, false);
              ELSE
                PERFORM setval(seq_name, max_id, true);
              END IF;
            END IF;
          END $$;
        `);
      } catch (seqErr: any) {
        console.warn('Sequence reset notice:', seqErr?.message || seqErr);
      }

      // 2. Fetch existing permissions
      const existingPermissions = await this.permissionRepository.find();
      const existingLabels = new Set(
        existingPermissions.map((p) => (p.label ? p.label.trim().toLowerCase() : '')),
      );

      const missingPermissions = permissionData.filter(
        (item) => !existingLabels.has(item.label.trim().toLowerCase()),
      );

      if (missingPermissions.length === 0) {
        console.log(
          `✔ All ${permissionData.length} permissions already exist in the database (${existingPermissions.length} records found). No changes needed.`,
        );
        return {
          totalPredefined: permissionData.length,
          alreadyExisting: existingPermissions.length,
          inserted: 0,
          message: 'All permissions are already up-to-date',
        };
      }

      console.log(
        `📦 Found ${existingPermissions.length} existing permissions. Adding ${missingPermissions.length} missing permissions...`,
      );

      const insertedLabels: string[] = [];

      for (const item of missingPermissions) {
        try {
          const perm = this.permissionRepository.create({
            label: item.label,
            base: item.base,
          });
          const saved = await this.permissionRepository.save(perm);
          insertedLabels.push(saved.label);
        } catch (itemErr: any) {
          console.warn(`Could not insert permission "${item.label}":`, itemErr?.message || itemErr);
        }
      }

      console.log(`✅ Successfully seeded ${insertedLabels.length} missing permissions into the database!`);

      return {
        totalPredefined: permissionData.length,
        alreadyExisting: existingPermissions.length,
        inserted: insertedLabels.length,
        insertedLabels,
        message: `Successfully seeded ${insertedLabels.length} missing permissions`,
      };
    } catch (error) {
      console.error('❌ Error during permission seeding:', error);
      throw error;
    }
  }
}
