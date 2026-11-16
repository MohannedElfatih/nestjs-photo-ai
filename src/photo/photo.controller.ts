import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { User } from '../user/entities/user.entity.js';
import { CreatePhotoDto } from './dto/create-photo.dto.js';
import { SearchPhotoDto } from './dto/search-photo.dto.js';
import { PhotoService } from './photo.service.js';

@Controller('photo')
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  // Creates a user + photo + metadata + album and returns the photo with relations.
  @Post('demo')
  createDemo() {
    return this.photoService.createDemo();
  }

  // Multipart upload: the "file" field is read into memory (max 5 MB) by multer, then written to disk.
  @Post()
  // Tells Swagger UI to show a file picker; the plugin can't infer this from @UploadedFile().
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'file'],
      properties: {
        name: { type: 'string', maxLength: 100 },
        isPublished: { type: 'boolean' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  create(
    @Body() dto: CreatePhotoDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: User,
  ) {
    return this.photoService.create(dto, file, user);
  }

  // Re-runs the AI description on the stored file.
  @Post(':id/describe')
  describe(@Param('id', ParseIntPipe) id: number) {
    return this.photoService.describe(id);
  }

  // Sends the image back. Unpublished photos are visible only to their author.
  @Get(':id/file')
  async file(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    const { stream, mimeType } = await this.photoService.getFile(id, user);
    return new StreamableFile(stream, { type: mimeType });
  }

  // Search by meaning, e.g. ?q=snowy animals. Declared before the :id routes.
  @Get('search')
  search(@Query() query: SearchPhotoDto, @CurrentUser() user: User) {
    return this.photoService.search(query.q, user);
  }

  @Get()
  findAll() {
    return this.photoService.findAll();
  }
}
