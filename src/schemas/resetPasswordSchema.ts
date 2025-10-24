import { z } from "zod";

// 📨 Step 1: Request password reset link
export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

// 🔐 Step 2: Submit new password
export const resetPasswordSchema = z.object({
  token: z
    .string()
    .min(20, "Invalid or malformed token")
    .max(255, "Token too long"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string(),
})
.refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// ✅ Inferred types
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
