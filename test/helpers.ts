import { mkdir, rm } from 'node:fs/promises';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AiService } from '../src/ai/ai.service.js';
import { AppModule } from '../src/app.module.js';

/**
 * Stands in for Gemini: no network, no cost, and answers we control. Embeddings put the text on
 * one of three axes, so "cat" texts are close to each other and far from "dog" texts.
 */
export class FakeAiService {
  embeddingModel = 'test-embedding';
  next = { description: 'A cat on a sofa', tags: ['cat', 'sofa'] };

  describeImage = async () => this.next;

  embed = async (text: string) => {
    const axis = /cat/i.test(text) ? 0 : /dog/i.test(text) ? 1 : 2;
    return Array.from({ length: 768 }, (_, i) => (i === axis ? 1 : 0));
  };
}

export interface TestApp {
  app: INestApplication;
  ai: FakeAiService;
  server: ReturnType<INestApplication['getHttpServer']>;
}

/** The real AppModule, wired to the test database, with only the AI replaced. */
export async function createTestApp(): Promise<TestApp> {
  const ai = new FakeAiService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AiService)
    .useValue(ai)
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, ai, server: app.getHttpServer() };
}

/** Empties every table and the uploads folder, so each test starts from nothing. */
export async function resetState(app: INestApplication) {
  const dataSource = app.get(DataSource);
  const tables = dataSource.entityMetadatas.map((meta) => `"${meta.tableName}"`).join(', ');
  await dataSource.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  await rm(uploadDir(), { recursive: true, force: true });
  await mkdir(uploadDir(), { recursive: true });
}

export const uploadDir = () => process.env.UPLOAD_DIR!;

/**
 * The session cookie from a response, ready to send back. We pass it by hand because the cookie is
 * marked Secure, and the test client would refuse to return it over plain http.
 */
export function cookieFrom(res: request.Response): string {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  if (!cookies?.length) throw new Error('The response set no cookie');
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

/** Creates an account, which also signs it in. Returns the cookie and the created user. */
export async function signUp({ server }: TestApp, email: string, password = 'correct horse') {
  const res = await request(server)
    .post('/auth/sign-up')
    .send({ firstName: 'Test', lastName: 'User', email, password })
    .expect(201);
  return { cookie: cookieFrom(res), user: res.body as { id: number; email: string } };
}

// Just the first bytes of real files: the app identifies images by these.
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
export const NOT_AN_IMAGE = Buffer.from('<script>alert(1)</script>');
