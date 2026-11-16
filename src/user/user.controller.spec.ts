import { Test } from '@nestjs/testing';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

describe('UserController', () => {
  let controller: UserController;
  const userService = { create: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userService }],
    }).compile();
    controller = moduleRef.get(UserController);
  });

  it('hands the body to the service and returns what it returns', async () => {
    const dto = { firstName: 'Ana', lastName: 'Silva', email: 'ana@example.com', password: 'correct horse' };
    userService.create.mockResolvedValue({ id: 1 });

    await expect(controller.create(dto)).resolves.toEqual({ id: 1 });
    expect(userService.create).toHaveBeenCalledWith(dto);
  });
});
