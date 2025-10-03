// schemas/adminActionSchema.ts
import { z } from 'zod';
export const usernameValidation = z
    .string()
    .min(3, "Username must be atleast 3 characters")
    .max(25, "Username must be atmost 25 characters")
    .regex(/^[a-zA-Z0-9]+$/, "Username can only contain alphanumeric characters")

const passwordSchema = z.string().min(8, "Password must be at least 8 characters long")
                        .regex(
                          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
                          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
                        );

export const adminSignUpSchema = z.object({
  name: usernameValidation,
  email: z.string().email('Invalid email format'),
  password: passwordSchema,
});

export type AdminSignupInput = z.infer<typeof adminSignUpSchema>;


export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;



export const adminChangePasswordSchema = z.object({
  oldPassword: z.string().min(8, "Password must be at least 8 characters long"),
  newPassword: passwordSchema
});

export type AdminChangePasswordInput = z.infer<typeof adminChangePasswordSchema>;


export const updateAdminRoleSchema = z.object({
  adminId: z.number().positive('Admin ID must be a positive number'),
  role: z.enum(['user', 'admin'], {
    errorMap: () => ({ message: 'Role must be user or admin' })
  }).optional(),
  isActive: z.boolean().optional()
});

export const adminUserFilterSchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  role: z.enum(['user', 'admin']).optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
  search: z.string().optional()
});

export type UpdateAdminRoleInput = z.infer<typeof updateAdminRoleSchema>;
export type AdminUserFilterInput = z.infer<typeof adminUserFilterSchema>;


export const deleteAdminSchema = z.object({
  adminId: z.string().transform(val => {
    const num = Number(val);
    if (isNaN(num) || num <= 0) {
      throw new Error('Admin ID must be a positive number');
    }
    return num;
  })
});


export const getUsersQuerySchema = z.object({
  search: z.string().optional(),
  page: z.string().transform(val => Number(val) || 1).default('1'),
  limit: z.string().transform(val => Number(val) || 1000).default('1000'),
  sortBy: z.enum(['username', 'email', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const getUserParamsSchema = z.object({
  userId: z.string().transform(val => {
    const num = Number(val);
    if (isNaN(num)) {
      throw new Error('Invalid user ID');
    }
    return num;
  })
});

type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;
type GetUserParams = z.infer<typeof getUserParamsSchema>;
