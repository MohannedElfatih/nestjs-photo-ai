import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { AiService } from '../ai/ai.service.js';
import { EmbeddingTask } from '../common/enums/embedding-task.js';
import type { Photo } from './entities/photo.entity.js';
import { PhotoEmbeddingJob } from './photo-embedding.job.js';

describe('PhotoEmbeddingJob', () => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    getOne: vi.fn(),
  };
  const photos = { createQueryBuilder: vi.fn(() => builder), update: vi.fn() };
  const ai = { embeddingModel: 'new-model', embed: vi.fn() };
  const settings: Record<string, string> = {};
  const config = { get: (key: string) => settings[key] };

  const stalePhoto = { id: 4, name: 'Beach', description: 'Sunset', tags: ['sea'] };
  let job: PhotoEmbeddingJob;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(settings)) delete settings[key];
    // The job logs every re-embed; keep the test output readable.
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    builder.getOne.mockResolvedValue(stalePhoto);
    photos.update.mockResolvedValue({ affected: 1 });
    ai.embed.mockResolvedValue([0.5, 0.5]);

    job = new PhotoEmbeddingJob(
      photos as unknown as Repository<Photo>,
      ai as unknown as AiService,
      config as unknown as ConfigService,
    );
  });

  it('re-embeds one stale photo with the current model', async () => {
    await job.tick();

    expect(ai.embed).toHaveBeenCalledTimes(1);
    expect(ai.embed).toHaveBeenCalledWith(expect.stringContaining('Sunset'), EmbeddingTask.Document);
    expect(photos.update).toHaveBeenCalledWith(
      { id: 4, description: 'Sunset' },
      { embedding: [0.5, 0.5], embeddingModel: 'new-model' },
    );
  });

  it('looks for photos that have a description and a missing or different model', async () => {
    await job.tick();

    expect(builder.where).toHaveBeenCalledWith('photo.description IS NOT NULL');
    expect(builder.andWhere).toHaveBeenCalledWith(
      '(photo.embeddingModel IS NULL OR photo.embeddingModel <> :model)',
      { model: 'new-model' },
    );
  });

  it('does nothing when every photo is up to date', async () => {
    builder.getOne.mockResolvedValue(null);

    await job.tick();

    expect(ai.embed).not.toHaveBeenCalled();
    expect(photos.update).not.toHaveBeenCalled();
  });

  it('can be switched off with EMBEDDING_BACKFILL=false', async () => {
    settings.EMBEDDING_BACKFILL = 'false';

    await job.tick();

    expect(photos.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('skips a photo that just failed, so it cannot block the ones behind it', async () => {
    ai.embed.mockRejectedValueOnce(new Error('quota exceeded'));

    await job.tick(); // fails for photo 4
    await job.tick(); // must exclude photo 4

    expect(builder.andWhere).toHaveBeenCalledWith('photo.id NOT IN (:...skip)', { skip: [4] });
  });

  it('does not start a second run while one is still waiting on the API', async () => {
    let finish!: (vector: number[]) => void;
    ai.embed.mockReturnValue(new Promise<number[]>((resolve) => (finish = resolve)));

    const first = job.tick();
    await job.tick(); // overlaps with the first: returns at once
    expect(builder.getOne).toHaveBeenCalledTimes(1);

    finish([1]);
    await first;
  });

  it('survives an unexpected error and runs again on the next tick', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    builder.getOne.mockRejectedValueOnce(new Error('database is down'));

    await expect(job.tick()).resolves.toBeUndefined();
    await job.tick();

    expect(ai.embed).toHaveBeenCalledTimes(1);
  });
});
