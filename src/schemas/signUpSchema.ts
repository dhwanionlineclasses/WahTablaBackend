import { z } from 'zod';

export const usernameValidation = z
    .string()
    .min(3, "Username must be atleast 3 characters")
    .max(25, "Username must be atmost 25 characters")
    .regex(/^[a-zA-Z0-9]+$/, "Username can only contain alphanumeric characters")

export const passwordValidation = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  );

export const signUpSchema = z.object({
  username: usernameValidation,
  email: z.string().email('Invalid email format'),
  password: passwordValidation,
});

// Type inference for User signup data validation
export type SignupInput = z.infer<typeof signUpSchema>;
