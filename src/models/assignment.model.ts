import { pgTable, pgEnum, serial, integer, varchar, boolean, timestamp, text, decimal } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { exams, examAttempts } from './exam.model';
import { users } from './user.model';
import { admins } from './admin.model';
import { assignmentQuestions } from './assignmentQuestion.model';

export const submissionTypeEnum = pgEnum('submission_type', ['text', 'link']);

export const assignmentSubmissions = pgTable('assignment_submissions', {
  submissionId: serial('submission_id').primaryKey(),
  examId: integer('exam_id').references(() => exams.examId).notNull(),
  userId: integer('user_id').references(() => users.userId).notNull(),
  attemptId: integer('attempt_id').references(() => examAttempts.attemptId).notNull(),
  questionId: integer('question_id').references(() => assignmentQuestions.questionId), // For individual questions
  submissionType: submissionTypeEnum('submission_type').notNull(),
  textAnswer: text('text_answer'),
  linkUrl: varchar('link_url', { length: 512 }),
  notes: text('notes'),
  totalMarks: decimal('total_marks', { precision: 5, scale: 2 }), // For final exams
  isChecked: boolean('is_checked').default(false),
  passed: boolean('passed'),
  feedback: text('feedback'),
  checkedBy: integer('checked_by').references(() => admins.adminId),
  submittedAt: timestamp('submitted_at').defaultNow(),
  checkedAt: timestamp('checked_at')
});


export const assignmentSubmissionsRelations = relations(assignmentSubmissions, ({ one }) => ({
  exam: one(exams, {
    fields: [assignmentSubmissions.examId],
    references: [exams.examId],
  }),
  user: one(users, {
    fields: [assignmentSubmissions.userId],
    references: [users.userId],
  }),
  attempt: one(examAttempts, {
    fields: [assignmentSubmissions.attemptId],
    references: [examAttempts.attemptId],
  }),
  checkedByAdmin: one(admins, {
    fields: [assignmentSubmissions.checkedBy],
    references: [admins.adminId],
  })
}));

export type AssignmentSubmission = typeof assignmentSubmissions.$inferSelect;
export type NewAssignmentSubmission = typeof assignmentSubmissions.$inferInsert;

export const assignmentSubmissionSchema = createInsertSchema(assignmentSubmissions);
export const assignmentSubmissionSchemaSelect = createSelectSchema(assignmentSubmissions);
