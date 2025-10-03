// models/admin.model.ts 
import { pgTable, pgEnum, serial, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { examAttempts } from './exam.model';
import { assignmentSubmissions } from './assignment.model';
import { certificates } from './certificate.model';

export const adminRoleEnum = pgEnum('admin_role', ['user', 'admin']); 

export const admins = pgTable('admins', {
  adminId: serial('admin_id').primaryKey(),
  name: varchar('username', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: adminRoleEnum('role').default('user').notNull(), 
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const adminsRelations = relations(admins, ({ many }) => ({
  gradedExamAttempts: many(examAttempts),
  checkedAssignments: many(assignmentSubmissions),
  issuedCertificates: many(certificates)
}));

export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;
export type AdminRole = 'user' | 'admin';

export const adminSchema = createInsertSchema(admins);
export const adminSchemaSelect = createSelectSchema(admins);
