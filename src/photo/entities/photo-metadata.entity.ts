import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Photo } from './photo.entity.js';

@Entity()
export class PhotoMetadata {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('int')
  height: number;

  @Column('int')
  width: number;

  @Column('text', { nullable: true })
  camera: string | null;

  // OneToOne, owning side: @JoinColumn puts the foreign key ("photoId") on THIS table.
  @OneToOne(() => Photo, (photo) => photo.metadata, { onDelete: 'CASCADE' })
  @JoinColumn()
  photo: Relation<Photo>;
}
