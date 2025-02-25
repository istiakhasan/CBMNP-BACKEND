import { Controller, Get, Post, Param, Body, HttpStatus, Query } from '@nestjs/common';

import { CommentService } from './comment.service';
import { Comments } from './entities/orderComment.entity';

@Controller('v1/comment')
export class CommentController {  
  constructor(private readonly commentService: CommentService) {}

  @Post()
  async createComment(@Body() payload: any): Promise<Comments> {
    return await this.commentService.createComment(payload);
  }


}
