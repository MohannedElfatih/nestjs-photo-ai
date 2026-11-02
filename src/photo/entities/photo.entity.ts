import {
  Column,
  Entity,
  ManyToMany,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../user/entities/user.entity.js';
import { Album } from './album.entity.js';
import { PhotoMetadata } from './photo-metadata.entity.js';

@Entity()
export class Photo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column()
  filename: string;

  @Column({ default: false })
  isPublished: boolean;

  // Postgres text[]; filled by the AI description step.
  @Column('text', { array: true, default: () => "'{}'" })
  tags: string[];

  // OneToOne, inverse side: no column here. The foreign key lives in photo_metadata.
  @OneToOne(() => PhotoMetadata, (metadata) => metadata.photo, { cascade: true })
  metadata: Relation<PhotoMetadata>;

  // ManyToOne: many photos belong to one user. This side owns the foreign key,
  // so the table gets an "authorId" column. No @JoinColumn needed (it is implied).
  @ManyToOne(() => User, (user) => user.photos, { onDelete: 'CASCADE' })
  author: Relation<User>;

  // ManyToMany, inverse side: the join table is defined on Album.
  @ManyToMany(() => Album, (album) => album.photos)
  albums: Relation<Album[]>;
}
