import { Test, TestingModule } from '@nestjs/testing';
import { UserpermissionService } from './userpermission.service';

describe('UserpermissionService', () => {
  let service: UserpermissionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserpermissionService],
    }).compile();

    service = module.get<UserpermissionService>(UserpermissionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
