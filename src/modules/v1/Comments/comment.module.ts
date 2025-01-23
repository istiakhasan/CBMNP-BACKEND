import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comments } from './entities/orderComment.entity';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { Order } from '../order/entities/order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comments,Order]),
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [],
})
export class CommentModule {}
