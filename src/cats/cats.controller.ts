import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpException,
  HttpStatus,
  UseFilters,
  ParseIntPipe,
  UsePipes,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  SerializeOptions,
} from '@nestjs/common';
import { CatsService } from './cats.service.js';
import { CreateCatDto } from './dto/create-cat.dto.js';
import { UpdateCatDto } from './dto/update-cat.dto.js';
import { Routes } from '../common/enums/routes.js';
import { ForbiddenException } from '../common/exception/forbidden.exception.js';
import { HttpExceptionFilter } from '../common/exception/http-exception.filter.js';
import { ValidationPipe } from '../common/pipes/validation.pipe.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor.js';

@Controller(Routes.CATS)
@UseGuards(RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class CatsController {
  constructor(private readonly catsService: CatsService) {}

  @Post()
  @UseFilters(HttpExceptionFilter)
  @UseInterceptors(LoggingInterceptor)
  @Roles(['admin'])
  create(@Body(new ValidationPipe()) createCatDto: CreateCatDto,) {
    return this.catsService.create(createCatDto);
  }

  @Get()
  findAll() {
    // return this.catsService.findAll();
    try {
      return this.catsService.findAll();
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.FORBIDDEN,
          error: 'This is a custom message',
        },
        HttpStatus.FORBIDDEN,
        {
          cause: error,
        },
      );
    }
  }

  @Get(':id')
  @SerializeOptions({ type: CreateCatDto })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCatDto: UpdateCatDto) {
    return this.catsService.update(id, updateCatDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catsService.remove(+id);
  }
}
