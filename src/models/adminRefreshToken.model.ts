// models/adminRefreshToken.model.ts
import { pgTable, serial, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { admins } from './admin.model';

export const adminRefreshTokens = pgTable('admin_refresh_tokens', {
  tokenId: serial('token_id').primaryKey(),
  token: varchar('token', { length: 512 }).notNull(),
  adminId: integer('admin_id').references(() => admins.adminId).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const adminRefreshTokensRelations = relations(adminRefreshTokens, ({ one }) => ({
  admin: one(admins, {
    fields: [adminRefreshTokens.adminId],
    references: [admins.adminId],
  }),
}));

export type AdminRefreshToken = typeof adminRefreshTokens.$inferSelect;
export type NewAdminRefreshToken = typeof adminRefreshTokens.$inferInsert;

export const adminRefreshTokenSchema = createInsertSchema(adminRefreshTokens);
export const adminRefreshTokenSchemaSelect = createSelectSchema(adminRefreshTokens);
