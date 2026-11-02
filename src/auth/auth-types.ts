import type { User } from '../user/entities/user.entity.js';

// Tells @nestjs/authentication what a "user" is, so @CurrentUser() is typed.
declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: User;
  }
}
