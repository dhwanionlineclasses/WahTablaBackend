// @types/admin.types.ts
export interface AdminWithoutPassword {
  adminId: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AdminRefreshToken {
  tokenId: number;
  token: string;
  adminId: number;
  expiresAt: Date;
  createdAt?: Date;
}

export type AdminRole = 'user' | 'admin';

export interface AdminJWTPayload {
  admin: AdminWithoutPassword;
  iat?: number;
  exp?: number;
}
