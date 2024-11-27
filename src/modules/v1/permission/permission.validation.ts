import { z } from 'zod';

export const CreatePermissionSchema = z
  .object({
    label: z.string({required_error:"Label is required"}),

  })
  .nonstrict();
