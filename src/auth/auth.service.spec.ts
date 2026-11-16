import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { UserService } from '../user/user.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService.validateUser', () => {
  let service: AuthService;
  const userService = { findWithPasswordHash: vi.fn() };
  let passwordHash: string;

  beforeAll(async () => {
    // 4 rounds instead of the production 12: the tests only need a valid hash, quickly.
    passwordHash = await hash('correct horse', 4);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [AuthService, { provide: UserService, useValue: userService }],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('returns the user when the password is right', async () => {
    const user = { id: 1, email: 'ana@example.com', passwordHash };
    userService.findWithPasswordHash.mockResolvedValue(user);

    await expect(service.validateUser('ana@example.com', 'correct horse')).resolves.toBe(user);
  });

  it('returns null when the password is wrong', async () => {
    userService.findWithPasswordHash.mockResolvedValue({ id: 1, passwordHash });

    await expect(service.validateUser('ana@example.com', 'wrong')).resolves.toBeNull();
  });

  it('returns null when no user has that email', async () => {
    userService.findWithPasswordHash.mockResolvedValue(null);

    await expect(service.validateUser('nobody@example.com', 'anything')).resolves.toBeNull();
  });
});
