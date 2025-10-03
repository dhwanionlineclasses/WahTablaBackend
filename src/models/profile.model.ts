import { pgEnum, pgTable, uuid, varchar, date, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './user.model';
import { createInsertSchema } from 'drizzle-zod';

export const genderEnum = pgEnum('gender', ['male', 'female']);

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.userId, {
      onDelete: 'cascade',
    }),
  fullName: varchar('full_name', { length: 100 }),
  gender: genderEnum('gender').default('male'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.userId],
  }),
}));

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

export const userProfileSchema = createInsertSchema(userProfiles);
