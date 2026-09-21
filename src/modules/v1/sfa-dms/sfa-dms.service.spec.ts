import { BadRequestException } from '@nestjs/common';
import { SfaDmsService } from './sfa-dms.service';
import { createDmsRepositoryMock } from '../../../test/helpers/dms-repository.mock';

describe('SfaDmsService', () => {
  const repositories = Array.from({ length: 9 }, createDmsRepositoryMock);
  const governance = { logAction: jest.fn() };
  const service = new SfaDmsService(
    repositories[0] as any, repositories[1] as any, repositories[2] as any,
    repositories[3] as any, repositories[4] as any, repositories[5] as any,
    repositories[6] as any, repositories[7] as any, repositories[8] as any,
    governance as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('creates a distributor only when required identity fields are supplied and audits it', async () => {
    const result = await service.create('distributors', 'org-id', { code: 'D-001', name: 'Dhaka Distributor' }, 'user-id');
    expect(result.organizationId).toBe('org-id');
    expect(governance.logAction).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'CREATE', entityName: 'SfaDms:distributors', userId: 'user-id' }), 'org-id');
  });

  it('rejects incomplete master data', async () => {
    await expect(service.create('distributors', 'org-id', { code: 'D-001' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not expose order items as a generic resource', async () => {
    await expect(service.create('orderItems', 'org-id', {})).rejects.toBeInstanceOf(BadRequestException);
  });
});
