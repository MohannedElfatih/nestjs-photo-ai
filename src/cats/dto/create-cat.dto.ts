import { Exclude, Expose } from 'class-transformer';
import { IsString, IsInt } from 'class-validator';

export class CreateCatDto {
  @IsString()
  name: string;

  @IsInt()
  age: number;

  @Exclude()
  @IsString()
  breed: string;

  @Expose()
  get fullName(): string {
    return `${this.name} ${this.age}`;
  }
  
  constructor(partial: Partial<CreateCatDto>) {
    Object.assign(this, partial);
  }
}
