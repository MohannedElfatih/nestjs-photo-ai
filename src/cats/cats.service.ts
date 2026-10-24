import { Injectable } from '@nestjs/common';
import { CreateCatDto } from './dto/create-cat.dto.js';
import { UpdateCatDto } from './dto/update-cat.dto.js';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, Interval } from '@nestjs/schedule';

@Injectable()
export class CatsService {
  private readonly cats: CreateCatDto[] = [];

  create(createCatDto: CreateCatDto) {
    this.cats.push(createCatDto);
  }

  findAll() {
    return this.cats;
  }

  findOne(id: number) {
    // return `This action returns a #${id} cat`;
    return {
      age: id,
      name: 'Tom',
      breed: 'Persian',
    };
  }

  update(id: number, updateCatDto: UpdateCatDto) {
    return `This action updates a #${id} cat`;
  }

  remove(id: number) {
    return `This action removes a #${id} cat`;
  }
}
