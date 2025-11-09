import { Test, TestingModule } from '@nestjs/testing';
import { DelivaryChargeController } from './delivary_charge.controller';
import { DelivaryChargeService } from './delivary_charge.service';

describe('DelivaryChargeController', () => {
  let controller: DelivaryChargeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DelivaryChargeController],
      providers: [DelivaryChargeService],
    }).compile();

    controller = module.get<DelivaryChargeController>(DelivaryChargeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
