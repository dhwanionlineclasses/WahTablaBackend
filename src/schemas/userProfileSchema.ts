import { z } from 'zod';

export const updateUserSchema = z.object({
  userId: z.number(),
  username: z.string().min(3).max(255).optional(),
  email: z.string().email().optional(),
  fullName: z.string().min(2).max(100).optional(),
  gender: z.enum(['male', 'female']).optional(),
});

export type UserProfile = z.infer<typeof updateUserSchema>;
