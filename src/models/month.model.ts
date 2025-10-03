import { pgTable, serial, integer, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { years } from './year.model';
import { modules } from './module.model';
import { videos } from './video.model';
import { courses } from './course.model';

export const months = pgTable('months', {
  monthId: serial('month_id').primaryKey(),
  courseId: integer('course_id').notNull().references(() => courses.courseId),
  yearId: integer('year_id')
    .notNull()
    .references(() => years.yearId),
  vimeoMonthId: varchar('vimeo_month_id',{ length: 255 }).notNull().unique(),
  monthName: varchar('month_name',{length : 255}).notNull().unique(),
  moduleId: integer('module_id')
    .notNull()
    .references(() => modules.moduleId),
  
})

// ,(table) => ({
//   unique: [table.yearId, table.monthName], // Add the unique constraint here
// }));

export const monthsRelations = relations(months, ({ one, many }) => ({
  course: one(courses, {
    fields: [months.courseId],
    references: [courses.courseId],
  }),
  year: one(years, {
    fields: [months.yearId],
    references: [years.yearId],
  }),
  module: one(modules, {
    fields: [months.moduleId],
    references: [modules.moduleId],
  }),
  videos: many(videos),
}));

export type Month = typeof months.$inferSelect;
export type NewMonth = typeof months.$inferInsert;

export const monthSchema = createInsertSchema(months);
