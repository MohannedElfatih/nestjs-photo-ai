import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service.js';
import { EmbeddingTask } from '../common/enums/embedding-task.js';
import { embeddingText } from './embedding-text.js';
import { Photo } from './entities/photo.entity.js';

const INTERVAL_MS = 10_000;
const RETRY_AFTER_MS = 5 * 60_000;

/**
 * Brings old embeddings up to date. Every 10 seconds it re-embeds ONE photo whose stored
 * embedding wasn't made by the currently configured model (or that has none). Change
 * GEMINI_EMBEDDING_MODEL and the whole table is migrated gradually, a photo at a time,
 * which keeps the API rate low. Set EMBEDDING_BACKFILL=false to switch it off.
 */
@Injectable()
export class PhotoEmbeddingJob {
  private readonly logger = new Logger(PhotoEmbeddingJob.name);
  // A slow call must not overlap with the next tick.
  private running = false;
  // Photos whose embedding just failed: photo id -> when to try again. Without this, one bad
  // photo would be picked every tick and block everything behind it.
  private readonly retryAt = new Map<number, number>();

  constructor(
    @InjectRepository(Photo) private readonly photosRepository: Repository<Photo>,
    private readonly aiService: AiService,
    private readonly config: ConfigService,
  ) {}

  @Interval(INTERVAL_MS)
  async tick() {
    if (this.running || this.config.get('EMBEDDING_BACKFILL') === 'false') return;
    this.running = true;
    try {
      await this.refreshOne();
    } catch (error) {
      this.logger.error('Embedding backfill tick failed', error);
    } finally {
      this.running = false;
    }
  }

  private async refreshOne() {
    const now = Date.now();
    for (const [id, at] of this.retryAt) if (at <= now) this.retryAt.delete(id);

    const model = this.aiService.embeddingModel;
    const query = this.photosRepository
      .createQueryBuilder('photo')
      .select(['photo.id', 'photo.name', 'photo.description', 'photo.tags'])
      .where('photo.description IS NOT NULL') // nothing to embed without a description
      .andWhere('(photo.embeddingModel IS NULL OR photo.embeddingModel <> :model)', { model })
      .orderBy('photo.id', 'ASC');
    if (this.retryAt.size) query.andWhere('photo.id NOT IN (:...skip)', { skip: [...this.retryAt.keys()] });

    const photo = await query.getOne();
    if (!photo) return; // everything is up to date

    try {
      const embedding = await this.aiService.embed(embeddingText(photo), EmbeddingTask.Document);
      // Only write if the description is still the one we embedded: if a describe call changed
      // it meanwhile, this vector is stale, and the next tick picks the photo up again.
      const result = await this.photosRepository.update(
        { id: photo.id, description: photo.description! },
        { embedding, embeddingModel: model },
      );
      this.logger.log(`Re-embedded photo ${photo.id} with ${model}${result.affected ? '' : ' (skipped: changed meanwhile)'}`);
    } catch {
      this.retryAt.set(photo.id, now + RETRY_AFTER_MS);
      this.logger.warn(`Embedding photo ${photo.id} failed; retrying in ${RETRY_AFTER_MS / 60_000} minutes`);
    }
  }
}
