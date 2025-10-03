import { pgTable, serial, integer, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { years } from './year.model';
import { months } from './month.model';
import { courses } from './course.model';

export const modules = pgTable('modules', {
  moduleId: serial('module_id').primaryKey(),
  courseId: integer('course_id').notNull().references(() => courses.courseId),
  yearId: integer('year_id')
    .notNull()
    .references(() => years.yearId),
  moduleName: varchar('module_name',{ length: 255 }).notNull().unique(),

});

export const modulesRelations = relations(modules, ({ one, many }) => ({
  course: one(courses, {
    fields: [modules.courseId],
    references: [courses.courseId],
  }),
  year: one(years, {
    fields: [modules.yearId],
    references: [years.yearId],
  }),
  months: many(months),
}));

export type Module = typeof modules.$inferSelect;
export type NewModule = typeof modules.$inferInsert;

export const moduleSchema = createInsertSchema(modules);
