import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum([
    'MR', 'TRADE_REP', 'DISTRIBUTOR_REP', 'ASM', 'RSM', 'ZM',
    'NSM', 'PRODUCT_MANAGER', 'MARKETING', 'SALES_ADMIN', 'SUPER_ADMIN',
  ]),
  phone: z.string().optional(),
  employeeId: z.string().optional(),
});
