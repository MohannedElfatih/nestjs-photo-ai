import request from 'supertest';
import { createTestApp, resetState, type TestApp } from './helpers.js';

describe('Protected by default (e2e)', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());
  beforeEach(() => resetState(ctx.app));

  // The global guard denies everything that isn't marked @Public().
  it.each([
    ['GET', '/'],
    ['GET', '/auth/me'],
    ['GET', '/photo'],
    ['GET', '/photo/search?q=cat'],
    ['POST', '/photo'],
    ['POST', '/chat'],
    ['POST', '/ai/ask'],
  ])('%s %s needs a signed-in user', async (method, path) => {
    const res = await request(ctx.server)[method.toLowerCase() as 'get' | 'post'](path);

    expect(res.status).toBe(401);
  });

  it('keeps the sign-up and sign-in routes open', async () => {
    // Any answer except 401 proves the guard let the request through to validation.
    const signUp = await request(ctx.server).post('/auth/sign-up').send({});
    const signIn = await request(ctx.server).post('/auth/sign-in').send({});

    expect(signUp.status).toBe(400);
    expect(signIn.status).toBe(400);
  });

  it('answers the health check without signing in', async () => {
    const res = await request(ctx.server).get('/health').expect(200);

    expect(res.body).toEqual({ status: 'ok' });
  });

  it('does not expose the dev login unless it is switched on', async () => {
    const res = await request(ctx.server).post('/dev/login');

    expect(res.status).toBe(404);
  });
});
