import { readdir } from 'node:fs/promises';
import request from 'supertest';
import {
  createTestApp,
  NOT_AN_IMAGE,
  PNG,
  resetState,
  signUp,
  uploadDir,
  type TestApp,
} from './helpers.js';

describe('Photos (e2e)', () => {
  let ctx: TestApp;
  let ana: Awaited<ReturnType<typeof signUp>>;
  let ben: Awaited<ReturnType<typeof signUp>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());

  beforeEach(async () => {
    await resetState(ctx.app);
    ctx.ai.next = { description: 'A cat on a sofa', tags: ['cat', 'sofa'] };
    ana = await signUp(ctx, 'ana@example.com');
    ben = await signUp(ctx, 'ben@example.com');
  });

  /** Uploads a photo the way a browser form would: multipart, a text field and a file. */
  const upload = (
    cookie: string,
    { name = 'Test', published = false, file = PNG, contentType = 'image/png' } = {},
  ) =>
    request(ctx.server)
      .post('/photo')
      .set('Cookie', cookie)
      .field('name', name)
      .field('isPublished', String(published))
      .attach('file', file, { filename: 'upload.png', contentType });

  describe('POST /photo', () => {
    it('stores the file, creates the photo, and fills in the AI description', async () => {
      const res = await upload(ana.cookie, { name: 'Cat' }).expect(201);

      expect(res.body).toMatchObject({
        name: 'Cat',
        isPublished: false,
        description: 'A cat on a sofa',
        tags: ['cat', 'sofa'],
      });
      expect(res.body.filename).toMatch(/\.png$/);
      expect(await readdir(uploadDir())).toEqual([res.body.filename]);
    });

    it('never returns the embedding or the model that made it', async () => {
      const res = await upload(ana.cookie).expect(201);

      expect(res.body).not.toHaveProperty('embedding');
      expect(res.body).not.toHaveProperty('embeddingModel');
    });

    it('converts the "isPublished" form field from text to a boolean', async () => {
      const res = await upload(ana.cookie, { published: true }).expect(201);

      expect(res.body.isPublished).toBe(true);
    });

    it('rejects a file that is not an image, whatever its declared type, and writes nothing', async () => {
      await upload(ana.cookie, { file: NOT_AN_IMAGE, contentType: 'image/png' }).expect(400);

      expect(await readdir(uploadDir())).toEqual([]);
    });

    it('rejects a request without a file', async () => {
      await request(ctx.server).post('/photo').set('Cookie', ana.cookie).field('name', 'No file').expect(400);
    });

    it('rejects a request without a name, and writes nothing', async () => {
      await request(ctx.server)
        .post('/photo')
        .set('Cookie', ana.cookie)
        .attach('file', PNG, { filename: 'upload.png', contentType: 'image/png' })
        .expect(400);

      expect(await readdir(uploadDir())).toEqual([]);
    });

    it('still saves the photo when the AI is down, so nothing the user uploaded is lost', async () => {
      const describeImage = ctx.ai.describeImage;
      ctx.ai.describeImage = async () => {
        throw new Error('provider unavailable');
      };

      let res: request.Response;
      try {
        res = await upload(ana.cookie).expect(201);
      } finally {
        ctx.ai.describeImage = describeImage; // don't break the tests that run after this one
      }

      expect(res.body.description).toBeNull();
      expect(await readdir(uploadDir())).toHaveLength(1);
    });
  });

  describe('GET /photo/:id/file', () => {
    it('returns the stored bytes with the right content type', async () => {
      const { body: photo } = await upload(ana.cookie).expect(201);

      const res = await request(ctx.server)
        .get(`/photo/${photo.id}/file`)
        .set('Cookie', ana.cookie)
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/image\/png/);
      expect((res.body as Buffer).equals(PNG)).toBe(true);
    });

    it('hides an unpublished photo from other users', async () => {
      const { body: photo } = await upload(ana.cookie, { published: false }).expect(201);

      await request(ctx.server).get(`/photo/${photo.id}/file`).set('Cookie', ben.cookie).expect(403);
    });

    it('shows a published photo to other users', async () => {
      const { body: photo } = await upload(ana.cookie, { published: true }).expect(201);

      await request(ctx.server).get(`/photo/${photo.id}/file`).set('Cookie', ben.cookie).expect(200);
    });

    it('404s for a photo that does not exist', async () => {
      await request(ctx.server).get('/photo/12345/file').set('Cookie', ana.cookie).expect(404);
    });
  });

  describe('POST /photo/:id/describe', () => {
    it('describes the photo again from its stored file', async () => {
      const { body: photo } = await upload(ana.cookie).expect(201);
      ctx.ai.next = { description: 'A dog in a park', tags: ['dog'] };

      const res = await request(ctx.server).post(`/photo/${photo.id}/describe`).set('Cookie', ana.cookie).expect(201);

      expect(res.body).toMatchObject({ description: 'A dog in a park', tags: ['dog'] });
    });

    it('404s for a photo that does not exist', async () => {
      await request(ctx.server).post('/photo/12345/describe').set('Cookie', ana.cookie).expect(404);
    });
  });

  describe('GET /photo/search', () => {
    const search = (cookie: string, q: string) =>
      request(ctx.server).get('/photo/search').query({ q }).set('Cookie', cookie).expect(200);

    it('ranks photos by meaning, nearest first, with the distance', async () => {
      ctx.ai.next = { description: 'A cat on a sofa', tags: ['cat'] };
      const cat = (await upload(ana.cookie, { name: 'Cat' }).expect(201)).body;
      ctx.ai.next = { description: 'A dog in a park', tags: ['dog'] };
      const dog = (await upload(ana.cookie, { name: 'Dog' }).expect(201)).body;

      const res = await search(ana.cookie, 'my cat');

      expect(res.body.map((photo: { id: number }) => photo.id)).toEqual([cat.id, dog.id]);
      expect(res.body[0].distance).toBeCloseTo(0, 5); // same direction as the query
      expect(res.body[1].distance).toBeCloseTo(1, 5); // unrelated
    });

    it('does not leak the embedding in the results', async () => {
      await upload(ana.cookie).expect(201);

      const res = await search(ana.cookie, 'cat');

      expect(res.body[0]).not.toHaveProperty('embedding');
      expect(res.body[0]).not.toHaveProperty('embeddingModel');
    });

    it('shows your own photos and published ones, but not other people\'s private photos', async () => {
      await upload(ana.cookie, { name: 'Private', published: false }).expect(201);
      await upload(ana.cookie, { name: 'Shared', published: true }).expect(201);

      const asAna = await search(ana.cookie, 'cat');
      const asBen = await search(ben.cookie, 'cat');

      expect(asAna.body.map((p: { name: string }) => p.name).sort()).toEqual(['Private', 'Shared']);
      expect(asBen.body.map((p: { name: string }) => p.name)).toEqual(['Shared']);
    });

    it('skips photos that have no embedding yet', async () => {
      const embed = ctx.ai.embed;
      ctx.ai.embed = async () => {
        throw new Error('embedding provider down');
      };
      try {
        await upload(ana.cookie).expect(201); // saved and described, but not embedded
      } finally {
        ctx.ai.embed = embed; // the search below must be able to embed its query
      }

      const res = await search(ana.cookie, 'cat');

      expect(res.body).toEqual([]);
    });

    it('requires a query', async () => {
      await request(ctx.server).get('/photo/search').set('Cookie', ana.cookie).expect(400);
    });
  });
});
