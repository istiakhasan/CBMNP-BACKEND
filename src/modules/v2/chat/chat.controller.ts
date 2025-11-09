import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() body: any) {
    // ✅ Do NOT wrap inside another { reply: ... }
    return await this.chatService.handleMessage(
      body.message,
      body.sessionId,
      body.organizationId,
    );
  }
}
