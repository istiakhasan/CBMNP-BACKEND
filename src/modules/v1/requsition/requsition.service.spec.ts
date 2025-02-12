import { Test, TestingModule } from '@nestjs/testing';
import { RequsitionService } from './requsition.service';

describe('RequsitionService', () => {
  let service: RequsitionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RequsitionService],
    }).compile();

    service = module.get<RequsitionService>(RequsitionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
