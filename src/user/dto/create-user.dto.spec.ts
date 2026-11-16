import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto.js';

// What the global ValidationPipe does with a request body: turn the plain JSON into a
// DTO instance, then run the decorators' rules against it.
const errorsFor = async (body: object) => {
  const errors = await validate(plainToInstance(CreateUserDto, body));
  return errors.map((error) => error.property);
};

describe('CreateUserDto', () => {
  const valid = { firstName: 'Ana', lastName: 'Silva', email: 'ana@example.com', password: 'correct horse' };

  it('accepts a complete, valid body', async () => {
    expect(await errorsFor(valid)).toEqual([]);
  });

  it.each([
    ['email', { email: 'not-an-email' }],
    ['password', { password: 'short' }],
    ['firstName', { firstName: 'x'.repeat(51) }],
    ['lastName', { lastName: undefined }],
  ])('rejects an invalid %s', async (field, override) => {
    expect(await errorsFor({ ...valid, ...override })).toContain(field);
  });

  it('reports every problem at once', async () => {
    expect(await errorsFor({})).toEqual(expect.arrayContaining(['firstName', 'lastName', 'email', 'password']));
  });
});
