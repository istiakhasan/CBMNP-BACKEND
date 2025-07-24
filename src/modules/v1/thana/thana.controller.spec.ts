import { Test, TestingModule } from '@nestjs/testing';
import { ThanaController } from './thana.controller';
import { ThanaService } from './thana.service';

describe('ThanaController', () => {
  let controller: ThanaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ThanaController],
      providers: [ThanaService],
    }).compile();

    controller = module.get<ThanaController>(ThanaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
