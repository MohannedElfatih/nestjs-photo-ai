import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UserModule } from '../user/user.module.js';
import { AuthController } from './auth.controller.js';
import { SessionAuth } from './session-auth.provider.js';

@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [AuthService, SessionAuth],
})
export class AuthModule {}
