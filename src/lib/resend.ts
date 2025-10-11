import { Resend } from 'resend';

// Initialize once globally
export const resend = new Resend(process.env.RESEND_API_KEY!);
