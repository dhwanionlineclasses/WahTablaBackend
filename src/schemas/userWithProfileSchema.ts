import { z } from 'zod';

export const userWithProfileSchema = z.object({
  userId: z.number(),
  username: z.string(),
  email: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  profile: z.object({
    id: z.string().uuid(),
    fullName: z.string().nullable(),
    gender: z.enum(['male', 'female']),
    createdAt: z.date(),
    updatedAt: z.date(),
  }).nullable(),
});
