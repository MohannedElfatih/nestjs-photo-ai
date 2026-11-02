import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module.js';
import { Photo } from '../photo/entities/photo.entity.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';

@Module({
  imports: [AiModule, TypeOrmModule.forFeature([Photo])],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
