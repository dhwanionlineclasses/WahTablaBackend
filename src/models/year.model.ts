import { pgTable, serial, integer,varchar, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { courses } from './course.model';
import { months } from './month.model';
import { modules } from './module.model';
import { exams } from './exam.model';
import { certificates } from './certificate.model';

export const years = pgTable('years', {
  yearId: serial('year_id').primaryKey(),
  courseId: integer('course_id')
    .notNull()
    .references(() => courses.courseId),
  vimeoYearId: varchar('vimeo_year_id', { length: 255 }).notNull().unique(),
  yearName: varchar('year_name',{ length: 255 }).notNull().unique(),
});

// ,(table) => ({
//   unique: [table.courseId, table.yearName], // Add the unique constraint here
// }));

export const yearsRelations = relations(years, ({ one, many }) => ({
  course: one(courses, {
    fields: [years.courseId],
    references: [courses.courseId],
  }),
  modules: many(modules),
  months: many(months),
  exams: many(exams),
  certificates: many(certificates)
}));

export type Year = typeof years.$inferSelect;
export type NewYear = typeof years.$inferInsert;

export const yearSchema = createInsertSchema(years);
