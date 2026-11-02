import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser, Public, SignInService } from '@nestjs/authentication';
import { CreateUserDto } from '../user/dto/create-user.dto.js';
import { User } from '../user/entities/user.entity.js';
import { UserService } from '../user/user.service.js';
import { SignInDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly signInService: SignInService,
  ) {}

  @Public()
  @Post('sign-up')
  async signUp(@Body() body: CreateUserDto) {
    const user = await this.userService.create(body);
    await this.signInService.signIn(String(user.id), { method: 'password' });
    return user;
  }

  @Public()
  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body() body: SignInDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.signInService.signIn(String(user.id), { method: 'password' });
    return user;
  }

  // Not @Public(): the global guard already requires a signed-in user.
  @Post('sign-out')
  @HttpCode(204)
  async signOut() {
    await this.signInService.signOut();
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return user;
  }
}
