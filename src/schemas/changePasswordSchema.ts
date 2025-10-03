import { z } from 'zod';

const passwordSchema = z.string().min(8, "Password must be at least 8 characters long")
                        .regex(
                          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
                          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
                        );

export const changePasswordSchema = z.object({
  oldPassword:z.string().min(8, "Password must be at least 8 characters long"),
  newPassword: passwordSchema
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
