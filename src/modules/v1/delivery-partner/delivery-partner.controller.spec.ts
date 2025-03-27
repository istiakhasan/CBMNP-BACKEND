import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryPartnerController } from './delivery-partner.controller';
import { DeliveryPartnerService } from './delivery-partner.service';

describe('DeliveryPartnerController', () => {
  let controller: DeliveryPartnerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeliveryPartnerController],
      providers: [DeliveryPartnerService],
    }).compile();

    controller = module.get<DeliveryPartnerController>(DeliveryPartnerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
