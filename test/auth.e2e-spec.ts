import request from 'supertest';
import { cookieFrom, createTestApp, resetState, signUp, type TestApp } from './helpers.js';

describe('Authentication (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());
  beforeEach(() => resetState(ctx.app));

  const account = { firstName: 'Ana', lastName: 'Silva', email: 'ana@example.com', password: 'correct horse' };

  describe('POST /auth/sign-up', () => {
    it('creates the account, signs it in, and returns only safe fields', async () => {
      const res = await request(ctx.server).post('/auth/sign-up').send(account).expect(201);

      expect(res.body).toMatchObject({ firstName: 'Ana', lastName: 'Silva', email: 'ana@example.com' });
      // The serializer strips everything marked @Exclude() on the entity.
      for (const hidden of ['passwordHash', 'password', 'createdAt', 'updatedAt', 'isActive', 'emailVerified']) {
        expect(res.body).not.toHaveProperty(hidden);
      }

      const me = await request(ctx.server).get('/auth/me').set('Cookie', cookieFrom(res)).expect(200);
      expect(me.body.email).toBe('ana@example.com');
    });

    it('refuses a second account with the same email, however it is capitalized', async () => {
      await request(ctx.server).post('/auth/sign-up').send(account).expect(201);

      await request(ctx.server).post('/auth/sign-up').send(account).expect(409);
      await request(ctx.server)
        .post('/auth/sign-up')
        .send({ ...account, email: '  ANA@Example.com ' })
        .expect(409);
    });

    it.each([
      ['a malformed email', { email: 'not-an-email' }],
      ['a short password', { password: 'short' }],
      ['a missing first name', { firstName: undefined }],
    ])('rejects %s', async (_name, override) => {
      await request(ctx.server)
        .post('/auth/sign-up')
        .send({ ...account, ...override })
        .expect(400);
    });

    it('ignores fields that are not part of the DTO, so nobody can make themselves an admin', async () => {
      const res = await request(ctx.server)
        .post('/auth/sign-up')
        .send({ ...account, role: 'admin', id: 999 })
        .expect(201);

      expect(res.body.role).toBe('user');
      expect(res.body.id).not.toBe(999);
    });
  });

  describe('POST /auth/sign-in', () => {
    beforeEach(() => signUp(ctx, 'ana@example.com'));

    it('signs in with the right password, whatever the capitalization of the email', async () => {
      const res = await request(ctx.server)
        .post('/auth/sign-in')
        .send({ email: 'ANA@example.com', password: 'correct horse' })
        .expect(200);

      const me = await request(ctx.server).get('/auth/me').set('Cookie', cookieFrom(res)).expect(200);
      expect(me.body.email).toBe('ana@example.com');
    });

    it('rejects a wrong password and an unknown email in the same way', async () => {
      const wrongPassword = await request(ctx.server)
        .post('/auth/sign-in')
        .send({ email: 'ana@example.com', password: 'wrong password' });
      const unknownEmail = await request(ctx.server)
        .post('/auth/sign-in')
        .send({ email: 'nobody@example.com', password: 'correct horse' });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      // Same message: the response must not reveal which emails have accounts.
      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it('sets no session when the sign-in fails', async () => {
      const res = await request(ctx.server)
        .post('/auth/sign-in')
        .send({ email: 'ana@example.com', password: 'wrong password' });

      expect(res.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('POST /auth/sign-out', () => {
    it('ends the session: the same cookie stops working', async () => {
      const { cookie } = await signUp(ctx, 'ana@example.com');
      await request(ctx.server).get('/auth/me').set('Cookie', cookie).expect(200);

      await request(ctx.server).post('/auth/sign-out').set('Cookie', cookie).expect(204);

      await request(ctx.server).get('/auth/me').set('Cookie', cookie).expect(401);
    });
  });

  it('keeps two users apart: each cookie belongs to its own account', async () => {
    const ana = await signUp(ctx, 'ana@example.com');
    const ben = await signUp(ctx, 'ben@example.com');

    const anaMe = await request(ctx.server).get('/auth/me').set('Cookie', ana.cookie).expect(200);
    const benMe = await request(ctx.server).get('/auth/me').set('Cookie', ben.cookie).expect(200);

    expect(anaMe.body.email).toBe('ana@example.com');
    expect(benMe.body.email).toBe('ben@example.com');
  });
});
