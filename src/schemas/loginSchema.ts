import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

// Type inference for User login data validation
export type LoginInput = z.infer<typeof loginSchema>;
