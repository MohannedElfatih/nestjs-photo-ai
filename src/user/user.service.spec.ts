import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { compare } from 'bcryptjs';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity.js';
import { UserService } from './user.service.js';

describe('UserService', () => {
  let service: UserService;

  // A fake repository: just enough of TypeORM's API, with every method a spy we can inspect.
  const repository = {
    existsBy: vi.fn(),
    create: vi.fn((data: Partial<User>) => data),
    save: vi.fn(async (user: Partial<User>) => ({ id: 1, ...user })),
    findOneBy: vi.fn(),
    createQueryBuilder: vi.fn(),
  };

  const dto = { firstName: 'Ana', lastName: 'Silva', email: 'ana@example.com', password: 'correct horse' };

  beforeEach(async () => {
    vi.clearAllMocks();
    repository.existsBy.mockResolvedValue(false);

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: repository },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(UserService);
  });

  describe('create', () => {
    it('stores a bcrypt hash and never the plain password', async () => {
      await service.create(dto);

      const entity = repository.create.mock.calls[0][0] as Record<string, unknown>;
      expect(entity).not.toHaveProperty('password');
      expect(entity.passwordHash).not.toBe(dto.password);
      expect(await compare(dto.password, entity.passwordHash as string)).toBe(true);
    });

    it('normalizes the email before checking for duplicates and saving', async () => {
      await service.create({ ...dto, email: '  Ana@Example.COM ' });

      expect(repository.existsBy).toHaveBeenCalledWith({ email: 'ana@example.com' });
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@example.com' }));
    });

    it('treats differently composed unicode emails as the same address', async () => {
      // "é" as one code point vs "e" + combining accent
      await service.create({ ...dto, email: 'josé@example.com' });

      expect(repository.existsBy).toHaveBeenCalledWith({ email: 'josé@example.com' });
    });

    it('rejects a duplicate email with a conflict and saves nothing', async () => {
      repository.existsBy.mockResolvedValue(true);

      await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findWithPasswordHash', () => {
    it('looks the user up by the normalized email and asks for the hash column', async () => {
      const builder = {
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue({ id: 1 }),
      };
      repository.createQueryBuilder.mockReturnValue(builder);

      await service.findWithPasswordHash(' ANA@example.com');

      expect(builder.addSelect).toHaveBeenCalledWith('user.passwordHash');
      expect(builder.where).toHaveBeenCalledWith('user.email = :email', { email: 'ana@example.com' });
    });
  });
});
