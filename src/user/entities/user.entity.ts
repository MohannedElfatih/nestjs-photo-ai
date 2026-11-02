import { Exclude } from 'class-transformer';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  type Relation,
} from 'typeorm';
import { Photo } from '../../photo/entities/photo.entity.js';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({ default: false })
  @Exclude()
  emailVerified: boolean;

  // Never store the plain password; select: false keeps it out of query results by default.
  @Column({ select: false })
  @Exclude()
  passwordHash: string;

  @Column({ default: 'user' })
  role: string;

  @Column({ default: true })
  @Exclude()
  isActive: boolean;

  // OneToMany: the inverse of Photo.author. No column here; the FK is on photo.
  @OneToMany(() => Photo, (photo) => photo.author)
  photos: Relation<Photo[]>;

  @CreateDateColumn()
  @Exclude()
  createdAt: Date;

  @UpdateDateColumn()
  @Exclude()
  updatedAt: Date;
}
