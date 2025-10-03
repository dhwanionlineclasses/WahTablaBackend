import { pgTable, serial, varchar, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './user.model';
import { createInsertSchema } from 'drizzle-zod';

// Define the refreshTokens table with the given properties
export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  token: varchar('token', { length: 512 }).notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.userId),  // Foreign key reference to Users table
  expiresAt: timestamp('expires_at').notNull(), // Expiration timestamp
  createdAt: timestamp('created_at').defaultNow(), // Creation timestamp
});


export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.userId],
  }),
}));


export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

// Schema validation using Zod
export const refreshTokenSchema = createInsertSchema(refreshTokens);
