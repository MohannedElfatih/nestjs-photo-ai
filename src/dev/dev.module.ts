import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DevController } from './dev.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [DevController],
})
export class DevModule {}
