import { randomUUID } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const MIME_BY_EXTENSION = Object.fromEntries(Object.entries(EXTENSION_BY_MIME).map(([mime, ext]) => [ext, mime]));

/**
 * The image type from the file's first bytes (its "magic number"), or null if it isn't a
 * supported image. The mimetype a client sends is just a claim; this looks at the content.
 */
export function detectImageType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** Stores image files on local disk. Swap this class for an S3 one later; callers only see filenames. */
@Injectable()
export class PhotoStorage {
  private readonly dir: string;

  constructor(config: ConfigService) {
    // Relative to where the server is started (the project root).
    this.dir = resolve(config.get<string>('UPLOAD_DIR', 'uploads'));
  }

  /** Writes the bytes under a generated name and returns that name. */
  async save(buffer: Buffer, mimeType: string): Promise<string> {
    // The name is ours (UUID + extension from the detected type), never the uploaded one.
    const filename = `${randomUUID()}${EXTENSION_BY_MIME[mimeType]}`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, filename), buffer);
    return filename;
  }

  read(filename: string): Promise<Buffer> {
    return readFile(this.pathOf(filename));
  }

  async exists(filename: string): Promise<boolean> {
    return stat(this.pathOf(filename)).then(
      (s) => s.isFile(),
      () => false,
    );
  }

  stream(filename: string): ReadStream {
    return createReadStream(this.pathOf(filename));
  }

  remove(filename: string): Promise<void> {
    return rm(this.pathOf(filename), { force: true });
  }

  mimeTypeOf(filename: string): string {
    return MIME_BY_EXTENSION[extname(filename)] ?? 'application/octet-stream';
  }

  // basename() strips any directory parts, so a name like "../../x" can't leave the folder.
  private pathOf(filename: string) {
    return join(this.dir, basename(filename));
  }
}
