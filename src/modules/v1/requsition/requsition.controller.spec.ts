import { Test, TestingModule } from '@nestjs/testing';
import { RequsitionController } from './requsition.controller';
import { RequsitionService } from './requsition.service';

describe('RequsitionController', () => {
  let controller: RequsitionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RequsitionController],
      providers: [RequsitionService],
    }).compile();

    controller = module.get<RequsitionController>(RequsitionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
