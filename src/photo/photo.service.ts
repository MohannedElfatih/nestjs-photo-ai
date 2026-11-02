import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity.js';
import { Photo } from './entities/photo.entity.js';
import { Album } from './entities/album.entity.js';
import { AiService } from '../ai/ai.service.js';
import { detectImageType, PhotoStorage } from './photo-storage.service.js';
import { CreatePhotoDto } from './dto/create-photo.dto.js';

/** What the service needs from an uploaded file; keeps it independent of the HTTP server's upload type. */
export interface ImageUpload {
  buffer: Buffer;
  mimetype: string;
}

@Injectable()
export class PhotoService {
  private readonly logger = new Logger(PhotoService.name);

  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(Photo) private photosRepository: Repository<Photo>,
    @InjectRepository(Album) private albumsRepository: Repository<Album>,
    private readonly aiService: AiService,
    private readonly storage: PhotoStorage,
  ) {}

  /** Saves the uploaded image to disk, creates the row, then asks the AI to describe it. */
  async create(dto: CreatePhotoDto, file: ImageUpload | undefined, author: User) {
    if (!file) throw new BadRequestException('Upload an image in the "file" field');
    // Check the content, not the client's claimed mimetype.
    const mimeType = detectImageType(file.buffer);
    if (!mimeType) throw new BadRequestException('Only JPEG, PNG or WebP images are supported');

    const filename = await this.storage.save(file.buffer, mimeType);
    let photo: Photo;
    try {
      photo = await this.photosRepository.save(
        this.photosRepository.create({ name: dto.name, isPublished: dto.isPublished ?? false, filename, author }),
      );
    } catch (error) {
      await this.storage.remove(filename); // don't leave a file with no row
      throw error;
    }

    // Best effort: the upload is already saved, so an AI failure shouldn't lose it.
    // The client can retry with POST /photo/:id/describe.
    try {
      return await this.applyDescription(photo, file.buffer, mimeType);
    } catch {
      this.logger.warn(`Photo ${photo.id} saved without a description`);
      return photo;
    }
  }

  /** Describes the stored image of an existing photo (also usable to re-run a failed description). */
  async describe(id: number) {
    const photo = await this.photosRepository.findOneBy({ id });
    if (!photo) throw new NotFoundException(`Photo ${id} not found`);
    if (!(await this.storage.exists(photo.filename))) throw new NotFoundException('Photo has no stored file');

    const buffer = await this.storage.read(photo.filename);
    return this.applyDescription(photo, buffer, this.storage.mimeTypeOf(photo.filename));
  }

  /** The stored file for a photo. Unpublished photos are visible only to their author. */
  async getFile(id: number, user: User) {
    const photo = await this.photosRepository.findOne({ where: { id }, relations: { author: true } });
    if (!photo) throw new NotFoundException(`Photo ${id} not found`);
    if (!photo.isPublished && photo.author?.id !== user.id) throw new ForbiddenException();
    if (!(await this.storage.exists(photo.filename))) throw new NotFoundException('Photo has no stored file');

    return { stream: this.storage.stream(photo.filename), mimeType: this.storage.mimeTypeOf(photo.filename) };
  }

  private async applyDescription(photo: Photo, buffer: Buffer, mimeType: string) {
    const { description, tags } = await this.aiService.describeImage(buffer, mimeType);
    photo.description = description;
    photo.tags = tags;
    return this.photosRepository.save(photo);
  }

  async createDemo() {
    // 1. A user (the "one" side of User -> Photos).
    const user = await this.usersRepository.save(
      this.usersRepository.create({
        firstName: 'Demo',
        lastName: 'User',
        email: `demo-${Date.now()}@example.com`,
        passwordHash: 'not-a-real-hash',
      }),
    );

    // 2. A photo with its metadata in ONE save: cascade: true on Photo.metadata
    //    inserts the metadata row too, and fills in photo_metadata.photoId.
    //    Setting `author` fills in photo.authorId.
    const photo = await this.photosRepository.save(
      this.photosRepository.create({
        name: 'Me and Bears',
        description: 'I am near polar bears',
        filename: 'photo-with-bears.jpg',
        isPublished: true,
        author: user,
        metadata: { height: 640, width: 480, camera: 'Canon' },
      }),
    );

    // 3. An album containing the photo. Album owns the ManyToMany (@JoinTable),
    //    so we set album.photos; saving inserts rows into album_photos_photo.
    await this.albumsRepository.save(
      this.albumsRepository.create({ name: 'Arctic trip', photos: [photo] }),
    );

    // 4. Read it back. Relations are NOT loaded unless you ask for them.
    return this.photosRepository.findOne({
      where: { id: photo.id },
      relations: { metadata: true, author: true, albums: true },
    });
  }

  findAll() {
    return this.photosRepository.find({
      relations: { metadata: true, author: true, albums: true },
    });
  }
}
