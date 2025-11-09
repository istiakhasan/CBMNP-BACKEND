import { Test, TestingModule } from '@nestjs/testing';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';

describe('ProcurementController', () => {
  let controller: ProcurementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [ProcurementService],
    }).compile();

    controller = module.get<ProcurementController>(ProcurementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
