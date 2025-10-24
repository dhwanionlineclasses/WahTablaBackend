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
})

// ✅ Inferred types
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
