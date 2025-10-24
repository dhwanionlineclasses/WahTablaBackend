import { relations } from 'drizzle-orm';
import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { userProfiles } from './profile.model';
import { examAttempts } from './exam.model';
import { assignmentSubmissions } from './assignment.model';
import { certificates } from './certificate.model';

export const users = pgTable('users', {
  userId: serial('user_id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  purchasePlan: varchar('purchase_plan', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export const userRelations = relations(users, ({ one, many  }) => ({
    profile: one(userProfiles, {
    fields: [users.userId],
    references: [userProfiles.userId],
  }),
    examAttempts: many(examAttempts),
    assignmentSubmissions: many(assignmentSubmissions),
    certificates: many(certificates)
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const userSchema = createInsertSchema(users);
