import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { AiService } from '../ai/ai.service.js';
import { defineTool } from '../ai/ai-tool.js';
import { Photo } from '../photo/entities/photo.entity.js';
import type { User } from '../user/entities/user.entity.js';

@Injectable()
export class ChatService {
  constructor(
    private readonly aiService: AiService,
    @InjectRepository(Photo) private readonly photosRepository: Repository<Photo>,
  ) {}

  chat(message: string, user: User) {
    return this.aiService.chatWithTools(message, this.toolsFor(user));
  }

  // The tools are built per request and close over the signed-in user. The model can pick
  // arguments, but it cannot pick whose photos are read: the owner always comes from the session.
  private toolsFor(user: User) {
    const listMyPhotos = defineTool({
      name: 'listMyPhotos',
      description: "Lists the signed-in user's photos (newest first, at most 50), optionally only those with a tag.",
      parameters: z.object({ tag: z.string().max(30).optional().describe('Only photos with this exact tag') }),
      run: async ({ tag }) => {
        const query = this.photosRepository
          .createQueryBuilder('photo')
          .select(['photo.id', 'photo.name', 'photo.description', 'photo.tags', 'photo.isPublished'])
          .where('photo.authorId = :userId', { userId: user.id })
          .orderBy('photo.id', 'DESC')
          .limit(50);
        if (tag) query.andWhere(':tag = ANY(photo.tags)', { tag });
        return query.getMany();
      },
    });

    const getPhoto = defineTool({
      name: 'getPhoto',
      description: "Gets one of the signed-in user's photos by its numeric id.",
      parameters: z.object({ id: z.number().int().positive() }),
      run: async ({ id }) => {
        const photo = await this.photosRepository.findOne({
          where: { id, author: { id: user.id } },
          select: { id: true, name: true, description: true, tags: true, isPublished: true },
        });
        return photo ?? { error: 'No photo with that id' };
      },
    });

    return [listMyPhotos, getPhoto];
  }
}
