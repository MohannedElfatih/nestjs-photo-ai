import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Photo } from './entities/photo.entity.js';
import { PhotoMetadata } from './entities/photo-metadata.entity.js';
import { Album } from './entities/album.entity.js';
import { User } from '../user/entities/user.entity.js';
import { PhotoController } from './photo.controller.js';
import { PhotoService } from './photo.service.js';
import { PhotoStorage } from './photo-storage.service.js';
import { PhotoEmbeddingJob } from './photo-embedding.job.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Photo, PhotoMetadata, Album, User]), AiModule],
  controllers: [PhotoController],
  providers: [PhotoService, PhotoStorage, PhotoEmbeddingJob],
})
export class PhotoModule {}
