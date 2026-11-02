import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { User } from '../user/entities/user.entity.js';
import { ChatDto } from './chat.dto.js';
import { ChatService } from './chat.service.js';

// Not @Public(): the tools read the signed-in user's photos.
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  chat(@Body() body: ChatDto, @CurrentUser() user: User) {
    return this.chatService.chat(body.message, user);
  }
}
