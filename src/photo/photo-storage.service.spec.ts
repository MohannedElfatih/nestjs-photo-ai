import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { detectImageType, PhotoStorage } from './photo-storage.service.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBP')]);

describe('detectImageType', () => {
  it.each([
    ['JPEG', JPEG, 'image/jpeg'],
    ['PNG', PNG, 'image/png'],
    ['WebP', WEBP, 'image/webp'],
  ])('recognizes %s by its first bytes', (_name, bytes, expected) => {
    expect(detectImageType(bytes)).toBe(expected);
  });

  it('rejects other content, whatever the client claims it is', () => {
    expect(detectImageType(Buffer.from('<script>alert(1)</script>'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
  });

  it('rejects buffers too short to hold a signature', () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it('needs RIFF and WEBP, not just one of them', () => {
    expect(detectImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]))).toBeNull();
  });
});

describe('PhotoStorage', () => {
  let root: string;
  let uploads: string;
  let storage: PhotoStorage;

  beforeEach(async () => {
    // A fresh temp folder per test; "uploads" doesn't exist yet, as on a new machine.
    root = await mkdtemp(join(tmpdir(), 'photo-storage-'));
    uploads = join(root, 'uploads');
    const config = { get: (key: string, fallback?: string) => (key === 'UPLOAD_DIR' ? uploads : fallback) };
    storage = new PhotoStorage(config as unknown as ConfigService);
  });

  afterEach(() => rm(root, { recursive: true, force: true }));

  it('creates the folder on first save and names the file itself', async () => {
    const filename = await storage.save(JPEG, 'image/jpeg');

    expect(filename).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(await readdir(uploads)).toEqual([filename]);
  });

  it('chooses the extension from the detected type', async () => {
    expect(await storage.save(PNG, 'image/png')).toMatch(/\.png$/);
    expect(await storage.save(WEBP, 'image/webp')).toMatch(/\.webp$/);
  });

  it('gives every file a different name', async () => {
    const names = await Promise.all([storage.save(JPEG, 'image/jpeg'), storage.save(JPEG, 'image/jpeg')]);
    expect(names[0]).not.toBe(names[1]);
  });

  it('reads back exactly the bytes that were saved', async () => {
    const filename = await storage.save(PNG, 'image/png');
    expect((await storage.read(filename)).equals(PNG)).toBe(true);
  });

  it('knows whether a file exists, and removes it without complaint when it is already gone', async () => {
    const filename = await storage.save(JPEG, 'image/jpeg');
    expect(await storage.exists(filename)).toBe(true);

    await storage.remove(filename);
    expect(await storage.exists(filename)).toBe(false);
    await expect(storage.remove(filename)).resolves.toBeUndefined();
  });

  it('cannot be tricked into reading outside the uploads folder', async () => {
    await storage.save(JPEG, 'image/jpeg'); // makes sure the folder exists
    await writeFile(join(root, 'secret.txt'), 'top secret');

    expect(await storage.exists('../secret.txt')).toBe(false);
    await expect(storage.read('../secret.txt')).rejects.toThrow();
  });

  it('maps extensions back to mime types, with a safe fallback', () => {
    expect(storage.mimeTypeOf('a.jpg')).toBe('image/jpeg');
    expect(storage.mimeTypeOf('a.png')).toBe('image/png');
    expect(storage.mimeTypeOf('a.webp')).toBe('image/webp');
    expect(storage.mimeTypeOf('a.exe')).toBe('application/octet-stream');
  });
});
