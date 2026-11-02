import { ConflictException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { DataSource, Repository } from 'typeorm';
import { hash } from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private dataSource: DataSource
  ) {}

  async create(createUserDto: CreateUserDto) {
    // Split password off: the entity has passwordHash, not password.
    const { password, ...rest } = createUserDto;
    const email = normalizeEmail(rest.email);
    if (await this.usersRepository.existsBy({ email })) {
      throw new ConflictException('Email already registered');
    }
    const newUser = this.usersRepository.create({
      ...rest,
      email,
      passwordHash: await hash(password, BCRYPT_ROUNDS),
    });
    return this.usersRepository.save(newUser);
  }

  findById(id: number) {
    return this.usersRepository.findOneBy({ id });
  }

  /** The user including passwordHash (it is select: false everywhere else). For sign-in only. */
  findWithPasswordHash(email: string) {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizeEmail(email) })
      .getOne();
  }

  findAll() {
    return `This action returns all user`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}

const normalizeEmail = (email: string) => email.trim().normalize('NFC').toLowerCase();
