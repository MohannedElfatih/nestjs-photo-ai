import { IsString, MaxLength, MinLength } from 'class-validator';

export class SearchPhotoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q: string;
}
