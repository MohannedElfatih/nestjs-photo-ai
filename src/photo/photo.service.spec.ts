import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiService } from '../ai/ai.service.js';
import { EmbeddingTask } from '../common/enums/embedding-task.js';
import { Album } from './entities/album.entity.js';
import { Photo } from './entities/photo.entity.js';
import { User } from '../user/entities/user.entity.js';
import { PhotoService } from './photo.service.js';
import { PhotoStorage } from './photo-storage.service.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const author = { id: 7 } as User;
const stranger = { id: 99 } as User;

describe('PhotoService', () => {
  let service: PhotoService;

  // Every collaborator is replaced by a fake. Nothing here touches a database, the disk or Gemini.
  const photos = {
    create: vi.fn((data: Partial<Photo>) => ({ ...data })),
    save: vi.fn(async (photo: Partial<Photo>) => ({ id: 1, ...photo })),
    update: vi.fn(),
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
  const ai = {
    embeddingModel: 'test-embedding',
    describeImage: vi.fn(),
    embed: vi.fn(),
  };
  const storage = {
    save: vi.fn(),
    remove: vi.fn(),
    exists: vi.fn(),
    read: vi.fn(),
    stream: vi.fn(),
    mimeTypeOf: vi.fn(),
  };
  const settings: Record<string, string> = {};
  const config = { get: (key: string) => settings[key] };

  beforeEach(async () => {
    vi.clearAllMocks();
    for (const key of Object.keys(settings)) delete settings[key];

    storage.save.mockResolvedValue('stored.jpg');
    storage.exists.mockResolvedValue(true);
    storage.mimeTypeOf.mockReturnValue('image/jpeg');
    storage.stream.mockReturnValue('stream-object');
    ai.describeImage.mockResolvedValue({ description: 'A cat on a sofa', tags: ['cat', 'sofa'] });
    ai.embed.mockResolvedValue([0.1, 0.2]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        PhotoService,
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Photo), useValue: photos },
        { provide: getRepositoryToken(Album), useValue: {} },
        { provide: AiService, useValue: ai },
        { provide: PhotoStorage, useValue: storage },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(PhotoService);
  });

  describe('create', () => {
    const upload = { buffer: JPEG, mimetype: 'image/jpeg' };

    it('rejects a request without a file before touching the disk', async () => {
      await expect(service.create({ name: 'x' }, undefined, author)).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('checks the content, not the mimetype the client claims', async () => {
      const fake = { buffer: Buffer.from('not an image'), mimetype: 'image/jpeg' };

      await expect(service.create({ name: 'x' }, fake, author)).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('stores the file, creates the row for the author, describes and embeds it', async () => {
      const result = await service.create({ name: 'Cat', isPublished: true }, upload, author);

      expect(storage.save).toHaveBeenCalledWith(JPEG, 'image/jpeg');
      expect(photos.create).toHaveBeenCalledWith({ name: 'Cat', isPublished: true, filename: 'stored.jpg', author });
      expect(ai.describeImage).toHaveBeenCalledWith(JPEG, 'image/jpeg');
      expect(result).toMatchObject({ description: 'A cat on a sofa', tags: ['cat', 'sofa'] });
      expect(ai.embed).toHaveBeenCalledWith(expect.stringContaining('A cat on a sofa'), EmbeddingTask.Document);
      expect(photos.update).toHaveBeenCalledWith(1, { embedding: [0.1, 0.2], embeddingModel: 'test-embedding' });
    });

    it('keeps new photos private unless the client asks otherwise', async () => {
      await service.create({ name: 'Cat' }, upload, author);

      expect(photos.create).toHaveBeenCalledWith(expect.objectContaining({ isPublished: false }));
    });

    it('deletes the stored file again if the row cannot be saved', async () => {
      photos.save.mockRejectedValueOnce(new Error('database is down'));

      await expect(service.create({ name: 'Cat' }, upload, author)).rejects.toThrow('database is down');
      expect(storage.remove).toHaveBeenCalledWith('stored.jpg');
    });

    it('still saves the photo when the AI description fails', async () => {
      ai.describeImage.mockRejectedValue(new Error('quota exceeded'));

      const result = await service.create({ name: 'Cat' }, upload, author);

      expect(result).toMatchObject({ id: 1, filename: 'stored.jpg' });
      expect(result).not.toHaveProperty('description');
      expect(storage.remove).not.toHaveBeenCalled();
    });

    it('keeps the description when only the embedding fails', async () => {
      ai.embed.mockRejectedValue(new Error('embedding down'));

      const result = await service.create({ name: 'Cat' }, upload, author);

      expect(result).toMatchObject({ description: 'A cat on a sofa' });
      expect(photos.update).not.toHaveBeenCalled();
    });
  });

  describe('describe', () => {
    it('404s for an unknown photo', async () => {
      photos.findOneBy.mockResolvedValue(null);

      await expect(service.describe(5)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s when the photo has no file on disk', async () => {
      photos.findOneBy.mockResolvedValue({ id: 5, filename: 'gone.jpg' });
      storage.exists.mockResolvedValue(false);

      await expect(service.describe(5)).rejects.toBeInstanceOf(NotFoundException);
      expect(ai.describeImage).not.toHaveBeenCalled();
    });

    it('describes the stored file using the type implied by its extension', async () => {
      photos.findOneBy.mockResolvedValue({ id: 5, name: 'Cat', filename: 'a.jpg' });
      storage.read.mockResolvedValue(JPEG);

      await service.describe(5);

      expect(ai.describeImage).toHaveBeenCalledWith(JPEG, 'image/jpeg');
    });
  });

  describe('getFile', () => {
    const photo = (overrides: Partial<Photo>) => ({ id: 3, filename: 'a.jpg', author, isPublished: false, ...overrides });

    it('lets the author see an unpublished photo', async () => {
      photos.findOne.mockResolvedValue(photo({}));

      await expect(service.getFile(3, author)).resolves.toEqual({ stream: 'stream-object', mimeType: 'image/jpeg' });
    });

    it('hides an unpublished photo from everybody else', async () => {
      photos.findOne.mockResolvedValue(photo({}));

      await expect(service.getFile(3, stranger)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('shows a published photo to anybody signed in', async () => {
      photos.findOne.mockResolvedValue(photo({ isPublished: true }));

      await expect(service.getFile(3, stranger)).resolves.toMatchObject({ mimeType: 'image/jpeg' });
    });

    it('404s for an unknown photo, and for one whose file is missing', async () => {
      photos.findOne.mockResolvedValueOnce(null);
      await expect(service.getFile(3, author)).rejects.toBeInstanceOf(NotFoundException);

      photos.findOne.mockResolvedValueOnce(photo({ isPublished: true }));
      storage.exists.mockResolvedValueOnce(false);
      await expect(service.getFile(3, author)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('search', () => {
    // The query builder is a chain: every step returns the builder, the last one returns the rows.
    const builder = {
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      setParameter: vi.fn().mockReturnThis(),
      getRawAndEntities: vi.fn(),
    };

    beforeEach(() => {
      photos.createQueryBuilder.mockReturnValue(builder);
      ai.embed.mockResolvedValue([1, 0, 0]);
      builder.getRawAndEntities.mockResolvedValue({
        entities: [{ id: 1 }, { id: 2 }, { id: 3 }],
        raw: [{ distance: '0.1' }, { distance: '0.4' }, { distance: '0.9' }],
      });
    });

    it('embeds the query as a query, and sends the vector as text', async () => {
      await service.search('cats', author);

      expect(ai.embed).toHaveBeenCalledWith('cats', EmbeddingTask.Query);
      expect(builder.setParameter).toHaveBeenCalledWith('vector', '[1,0,0]');
    });

    it('only compares vectors from the current model, for photos you may see', async () => {
      await service.search('cats', author);

      expect(builder.andWhere).toHaveBeenCalledWith('photo.embeddingModel = :model', { model: 'test-embedding' });
      expect(builder.andWhere).toHaveBeenCalledWith('(photo.authorId = :userId OR photo.isPublished = true)', {
        userId: 7,
      });
    });

    it('returns the photos with their distance as a number', async () => {
      const results = await service.search('cats', author);

      expect(results.map((r) => [r.id, r.distance])).toEqual([
        [1, 0.1],
        [2, 0.4],
        [3, 0.9],
      ]);
    });

    it('drops results beyond SEARCH_MAX_DISTANCE when it is set', async () => {
      settings.SEARCH_MAX_DISTANCE = '0.5';

      const results = await service.search('cats', author);

      expect(results.map((r) => r.id)).toEqual([1, 2]);
    });

    it('ignores a SEARCH_MAX_DISTANCE that is not a number', async () => {
      settings.SEARCH_MAX_DISTANCE = 'banana';

      expect(await service.search('cats', author)).toHaveLength(3);
    });
  });
});
