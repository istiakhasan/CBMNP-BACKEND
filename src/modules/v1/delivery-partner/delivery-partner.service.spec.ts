import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryPartnerService } from './delivery-partner.service';

describe('DeliveryPartnerService', () => {
  let service: DeliveryPartnerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeliveryPartnerService],
    }).compile();

    service = module.get<DeliveryPartnerService>(DeliveryPartnerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
