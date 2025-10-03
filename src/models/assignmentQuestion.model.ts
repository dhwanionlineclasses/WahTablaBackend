// models/assignmentQuestion.model.ts
import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { exams } from './exam.model';

export const assignmentQuestions = pgTable('assignment_questions', {
  questionId: serial('question_id').primaryKey(),
  examId: integer('exam_id').references(() => exams.examId).notNull(),
  question: text('question').notNull(),
  questionOrder: integer('question_order').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const assignmentQuestionsRelations = relations(assignmentQuestions, ({ one }) => ({
  exam: one(exams, {
    fields: [assignmentQuestions.examId],
    references: [exams.examId],
  })
}));

export type AssignmentQuestion = typeof assignmentQuestions.$inferSelect;
export type NewAssignmentQuestion = typeof assignmentQuestions.$inferInsert;

export const assignmentQuestionSchema = createInsertSchema(assignmentQuestions);
export const assignmentQuestionSchemaSelect = createSelectSchema(assignmentQuestions);
