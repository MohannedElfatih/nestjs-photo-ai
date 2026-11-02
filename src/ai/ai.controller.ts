import { Body, Controller, Post, Query, Sse, type MessageEvent } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { Public } from '@nestjs/authentication';
import { AiService } from './ai.service.js';
import { AskDto } from './ask.dto.js';

// Public for testing only: anyone can spend the API quota. Remove @Public() before deploying.
@Public()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  async ask(@Body() body: AskDto) {
    return { answer: await this.aiService.ask(body.prompt) };
  }

  // SSE: browsers' EventSource can only use GET, so the prompt travels in the query string.
  @Sse('stream')
  stream(@Query() query: AskDto): Observable<MessageEvent> {
    return this.aiService.stream(query.prompt);
  }
}
