import { Test, TestingModule } from '@nestjs/testing';
import { OrderServiceV2 } from './order.service';

describe('OrderServiceV2', () => {
  let service: OrderServiceV2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrderServiceV2],
    }).compile();

    service = module.get<OrderServiceV2>(OrderServiceV2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
