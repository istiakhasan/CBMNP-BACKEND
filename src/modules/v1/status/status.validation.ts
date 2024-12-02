import { z } from 'zod';


export const CreateStatusSchema = z.object({
  label: z.string({ required_error: 'Label is required' }),

});

