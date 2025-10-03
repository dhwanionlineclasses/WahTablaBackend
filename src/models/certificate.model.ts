// models/certificate.model.ts
import { pgTable, varchar, integer, timestamp, boolean, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { users } from './user.model';
import { courses } from './course.model';
import { admins } from './admin.model';
import { years } from './year.model';

export const certificates = pgTable('certificates', {
  certificateId: varchar('certificate_id', { length: 64 }).primaryKey(),
  userId: integer('user_id').references(() => users.userId).notNull(),
  courseId: integer('course_id').references(() => courses.courseId).notNull(),
  yearId: integer('year_id').references(() => years.yearId).notNull(), // Direct reference to year
  issuedBy: integer('issued_by').references(() => admins.adminId).notNull(),
  issuedAt: timestamp('issued_at').defaultNow(),
  emailSent: boolean('email_sent').default(false),
  emailSentAt: timestamp('email_sent_at')
}, (table) => ({
  uniqueUserCourseYear: unique().on(table.userId, table.courseId, table.yearId)
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, {
    fields: [certificates.userId],
    references: [users.userId],
  }),
  course: one(courses, {
    fields: [certificates.courseId],
    references: [courses.courseId],
  }),
  year: one(years, {
    fields: [certificates.yearId],
    references: [years.yearId],
  }),
  issuedByAdmin: one(admins, {
    fields: [certificates.issuedBy],
    references: [admins.adminId],
  })
}));

export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;

export const certificateSchema = createInsertSchema(certificates);
export const certificateSchemaSelect = createSelectSchema(certificates);
