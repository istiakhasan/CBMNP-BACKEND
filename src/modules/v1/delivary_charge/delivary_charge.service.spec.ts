import { Test, TestingModule } from '@nestjs/testing';
import { DelivaryChargeService } from './delivary_charge.service';

describe('DelivaryChargeService', () => {
  let service: DelivaryChargeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DelivaryChargeService],
    }).compile();

    service = module.get<DelivaryChargeService>(DelivaryChargeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
