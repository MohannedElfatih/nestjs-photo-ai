import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Photo } from './photo.entity.js';

@Entity()
export class Album {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // ManyToMany, owning side: @JoinTable creates the join table "album_photos_photo"
  // holding (albumId, photoId) pairs.
  @ManyToMany(() => Photo, (photo) => photo.albums)
  @JoinTable()
  photos: Relation<Photo[]>;
}
