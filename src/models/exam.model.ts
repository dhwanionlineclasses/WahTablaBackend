import { pgTable, pgEnum, serial, integer, varchar, boolean, timestamp, text, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { courses } from './course.model';
import { users } from './user.model';
import { admins } from './admin.model';
import { mcqQuestions, mcqResponses } from './mcq.model';
import { entranceMcqOptions, entranceMcqQuestions, entranceMcqResponses } from './entrance.mcq.model';
import { assignmentSubmissions } from './assignment.model';
import { assignmentQuestions } from './assignmentQuestion.model';
import { finalExamSections } from './finalExam.model';
import { years } from './year.model';

export const examTypeEnum = pgEnum('exam_type', ['mcq', 'assignment', 'final']);

export const exams = pgTable('exams', {
  examId: serial('exam_id').primaryKey(),
  courseId: integer('course_id').references(() => courses.courseId).notNull(),
  yearId: integer('year_id').references(() => years.yearId).notNull(),
  weekNumber: integer('week_number').notNull(),
  type: examTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  totalMarks: integer('total_marks'), // For final exams
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const examsRelations = relations(exams, ({ one, many }) => ({
  course: one(courses, {
    fields: [exams.courseId],
    references: [courses.courseId],
  }),
  year: one(years, {
    fields: [exams.yearId],
    references: [years.yearId],
  }),
  attempts: many(examAttempts),
  mcqQuestions: many(mcqQuestions),
  assignmentQuestions: many(assignmentQuestions),
  assignmentSubmissions: many(assignmentSubmissions),
  finalExamSections: many(finalExamSections)
}));

export const entranceExams = pgTable('entrance_exams', {
  examId: serial('exam_id').primaryKey(),
  courseId: integer('course_id').references(() => courses.courseId).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  totalMarks: integer('total_marks'), // For final exams
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const entranceExamsRelations = relations(entranceExams, ({ one, many }) => ({
  course: one(courses, {
    fields: [entranceExams.courseId],
    references: [courses.courseId],
  }),
  attempts: many(entranceExamAttempts),
  mcqQuestions: many(entranceMcqQuestions),
}));

export const examAttempts = pgTable('exam_attempts', {
  attemptId: serial('attempt_id').primaryKey(),
  examId: integer('exam_id').references(() => exams.examId).notNull(),
  userId: integer('user_id').references(() => users.userId).notNull(),
  attemptNumber: integer('attempt_number').default(0).notNull(),
  passed: boolean('passed').default(false),
  submittedAt: timestamp('submitted_at').defaultNow(),
  gradedAt: timestamp('graded_at'),
  gradedBy: integer('graded_by').references(() => admins.adminId),
}, (table) => ({
  uniqueUserExam: unique().on(table.examId, table.userId)
}));

export const examAttemptsRelations = relations(examAttempts, ({ one, many }) => ({
  exam: one(exams, {
    fields: [examAttempts.examId],
    references: [exams.examId],
  }),
  user: one(users, {
    fields: [examAttempts.userId],
    references: [users.userId],
  }),
  gradedByAdmin: one(admins, {
    fields: [examAttempts.gradedBy],
    references: [admins.adminId],
  }),
  mcqResponses: many(mcqResponses),
  assignmentSubmission: one(assignmentSubmissions, {
    fields: [examAttempts.attemptId],
    references: [assignmentSubmissions.attemptId],
  })
}));

export const entranceExamAttempts = pgTable('entrance_exam_attempts', {
  attemptId: serial('attempt_id').primaryKey(),
  entranceExamId: integer('entrance_exam_id').references(() => entranceExams.examId).notNull(),
  userId: integer('user_id').references(() => users.userId).notNull(),
  attemptNumber: integer('attempt_number').default(0).notNull(),
  passed: boolean('passed').default(false),
  mcqPassed: boolean('mcq_passed').default(false),
  submittedAt: timestamp('submitted_at').defaultNow(),
  gradedAt: timestamp('graded_at'),
  gradedBy: integer('graded_by').references(() => admins.adminId),
  videoUrl: varchar('video_url', { length: 255 }),
}, (table) => ({
  uniqueUserExam: unique().on(table.entranceExamId, table.userId)
}));

export const entranceExamAttemptsRelations = relations(entranceExamAttempts, ({ one, many }) => ({
  entranceExam: one(entranceExams, {
    fields: [entranceExamAttempts.entranceExamId],
    references: [entranceExams.examId],
  }),
  user: one(users, {
    fields: [entranceExamAttempts.userId],
    references: [users.userId],
  }),
  gradedByAdmin: one(admins, {
    fields: [entranceExamAttempts.gradedBy],
    references: [admins.adminId],
  }),
  mcqResponses: many(entranceMcqResponses),
  assignmentSubmission: one(assignmentSubmissions, {
    fields: [entranceExamAttempts.attemptId],
    references: [assignmentSubmissions.attemptId],
  })
}));

export type Exam = typeof exams.$inferSelect;
export type NewExam = typeof exams.$inferInsert;
export type EntranceExam = typeof entranceExams.$inferSelect;
export type NewEntranceExam = typeof entranceExams.$inferInsert;
export type ExamAttempt = typeof examAttempts.$inferSelect;
export type EntranceExamAttempt = typeof entranceExamAttempts.$inferSelect;
export type NewEntranceExamAttempt = typeof entranceExamAttempts.$inferInsert;

export const examSchema = createInsertSchema(exams);
export const examSchemaSelect = createSelectSchema(exams);
export const entranceExamSchema = createInsertSchema(entranceExams);
export const entranceExamSchemaSelect = createSelectSchema(entranceExams);
export const examAttemptSchema = createInsertSchema(examAttempts);
export const entranceExamAttemptSchema = createInsertSchema(entranceExamAttempts);
export const entranceExamAttemptSchemaSelect = createSelectSchema(entranceExamAttempts);
