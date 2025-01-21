import { z } from 'zod';
const RoleEnum = z.enum([
  'admin',
  'hr',
  'agent',
  'user',
  'ctgadmin',
  'cos',
  'warehouse_manager',
  'operation_manager',
  'cs_agent',
  'media_manager',
  'cs_website_agent',
]);
export const CreateUserSchema = z
  .object({
    userId: z.string().nonempty('User ID is required'),
    userName: z.string().nonempty('Username is required'),
    role: RoleEnum,
    password: z.string().nonempty('Password is required'),
    image: z.string().nullable().optional(),
  })
  .nonstrict();
export const loginSchema = z.object({
  userId: z
    .string({ required_error: 'User id is required' })
    .nonempty('User Id is required'),
  password: z
    .string({ required_error: 'Password is required' })
    .nonempty('Password is required'),
});
