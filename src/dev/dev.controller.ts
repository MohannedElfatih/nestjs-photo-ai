import { Controller, HttpCode, NotFoundException, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public, SignInService } from '@nestjs/authentication';
import { AuthService } from '../auth/auth.service.js';

/**
 * Development shortcut: signs the browser in with the credentials from DEV_LOGIN_EMAIL and
 * DEV_LOGIN_PASSWORD (an account that already exists), so Swagger UI is usable without typing them.
 * Does nothing (404) unless DEV_AUTO_LOGIN=true and NODE_ENV is not "production".
 */
@Public()
@Controller('dev')
export class DevController {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly signInService: SignInService,
  ) {}

  // POST, not GET: the auth package rejects cross-site state-changing requests, which a GET would skip.
  @Post('login')
  @HttpCode(200)
  async login() {
    if (this.config.get('DEV_AUTO_LOGIN') !== 'true' || this.config.get('NODE_ENV') === 'production') {
      throw new NotFoundException();
    }
    // Same check as the real sign-in. Never creates a user: a wrong email or password is a 401.
    const user = await this.authService.validateUser(
      this.config.getOrThrow<string>('DEV_LOGIN_EMAIL'),
      this.config.getOrThrow<string>('DEV_LOGIN_PASSWORD'),
    );
    if (!user) throw new UnauthorizedException('DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD do not match an account');
    await this.signInService.signIn(String(user.id), { method: 'password' });
    return user;
  }
}
