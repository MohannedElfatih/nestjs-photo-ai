import { Controller, Get } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Liveness check for Docker and hosting platforms: open to anyone, touches no data.
  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
