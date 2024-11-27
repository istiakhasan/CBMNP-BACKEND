import { Test, TestingModule } from '@nestjs/testing';
import { UserpermissionController } from './userpermission.controller';
import { UserpermissionService } from './userpermission.service';

describe('UserpermissionController', () => {
  let controller: UserpermissionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserpermissionController],
      providers: [UserpermissionService],
    }).compile();

    controller = module.get<UserpermissionController>(UserpermissionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
