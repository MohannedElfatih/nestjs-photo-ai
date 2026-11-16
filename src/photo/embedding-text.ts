import type { Photo } from './entities/photo.entity.js';

/**
 * The text that gets embedded for a photo. Shared by the upload flow and the background job, so
 * a photo gets the same embedding whichever one produced it.
 */
export const embeddingText = ({ name, description, tags }: Pick<Photo, 'name' | 'description' | 'tags'>) =>
  `${name}. ${description ?? ''} Tags: ${tags.join(', ')}`;
