import { Injectable } from '@nestjs/common';
import { compare, hashSync } from 'bcryptjs';
import { UserService } from '../user/user.service.js';
import type { User } from '../user/entities/user.entity.js';

// Compared against when the email is unknown, so the response time doesn't
// reveal which emails are registered.
const DUMMY_HASH = hashSync('dummy-password', 12);

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}

  /** The user, or null when the email or the password is wrong. */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userService.findWithPasswordHash(email);
    const valid = await compare(password, user?.passwordHash ?? DUMMY_HASH);
    return user && valid ? user : null;
  }
}
