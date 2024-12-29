import { z } from 'zod';

export const CategorySchema = z.object({
  label: z.string({ required_error: 'Label is required' }),

});
