import { z } from 'zod';

// The shape we ask the model to produce, and the check we run on what it returns.
export const photoDescriptionSchema = z.object({
  description: z.string().min(1).max(500).describe('One or two sentences describing the photo'),
  tags: z.array(z.string().min(1).max(30)).max(10).describe('Short lowercase keywords'),
});

export type PhotoDescription = z.infer<typeof photoDescriptionSchema>;
