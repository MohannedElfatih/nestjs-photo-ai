import { Body, Controller, Post, Query, Sse, type MessageEvent } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { AiService } from './ai.service.js';
import { AskDto } from './ask.dto.js';

// Not @Public(): the global guard means only signed-in users can spend the API quota.
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
