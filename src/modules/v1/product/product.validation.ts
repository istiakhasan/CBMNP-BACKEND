import { z } from 'zod';

export const ProductSchema = z.object({
  // images: z.array(z.string()).nonempty({ message: 'Images must include at least one image URL' }),
  name: z.string({required_error:"Name is required"}).min(1, { message: 'Name is required' }),
  description: z.string({required_error:"Description is required"}).min(1, { message: 'Description is required' }),
  weight: z.string({required_error:"Weight is required"}).min(1, { message: 'Weight is required' }),
  unit: z.string({required_error:"Unit is required"}).min(1, { message: 'Unit is required' }),
  regularPrice: z.string({ required_error: 'Regular Price must be a number' }).min(0, { message: 'MRP must be a positive number' }),
  salePrice: z.string({ required_error: 'Sale Price must be a number' }).min(0, { message: 'MRP must be a positive number' }),
  retailPrice: z.string({ required_error: 'Retail Price must be a number' }).min(0, { message: 'Retail Price must be a positive number' }),
  distributionPrice: z.string({ required_error: 'Distribution Price must be a number' }).min(0, { message: 'Distribution Price must be a positive number' }),
  purchasePrice: z.string({ required_error: 'Purchase Price must be a number' }).min(0, { message: 'Purchase Price must be a positive number' }),
});

export const CreateStatusSchema = z.object({
  label: z.string({ required_error: 'Label is required' }),
});
