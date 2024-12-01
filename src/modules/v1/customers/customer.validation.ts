import { z } from 'zod';

const CustomerTypeEnum = z.enum(['PROBASHI', 'NON_PROBASHI']);

export const CreateCustomerSchema = z.object({
  customerName: z.string({ required_error: 'Customer name is required' }),
  customerPhoneNumber: z.string({ required_error: 'Customer phone number is required' }),
  customerAdditionalPhoneNumber: z.string().optional(),
  address: z.string().optional(),
  division: z.string().optional(),
  district: z.string().optional(),
  thana: z.string().optional(),
  customerType: CustomerTypeEnum,
  country: z.string().optional(),
});

