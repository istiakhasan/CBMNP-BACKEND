import { Test, TestingModule } from '@nestjs/testing';
import { ThanaService } from './thana.service';

describe('ThanaService', () => {
  let service: ThanaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ThanaService],
    }).compile();

    service = module.get<ThanaService>(ThanaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
