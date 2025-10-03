// models/mcq.model.ts
import { pgTable, serial, integer, varchar, boolean, timestamp, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { exams, examAttempts } from './exam.model';

export const mcqQuestions = pgTable('mcq_questions', {
  questionId: serial('question_id').primaryKey(),
  examId: integer('exam_id').references(() => exams.examId).notNull(),
  question: text('question').notNull(),
  questionOrder: integer('question_order').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const mcqQuestionsRelations = relations(mcqQuestions, ({ one, many }) => ({
  exam: one(exams, {
    fields: [mcqQuestions.examId],
    references: [exams.examId],
  }),
  options: many(mcqOptions),
  responses: many(mcqResponses)
}));

export const mcqOptions = pgTable('mcq_options', {
  optionId: serial('option_id').primaryKey(),
  questionId: integer('question_id').references(() => mcqQuestions.questionId).notNull(),
  optionText: varchar('option_text', { length: 512 }).notNull(),
  isCorrect: boolean('is_correct').default(false),
  optionOrder: integer('option_order').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const mcqOptionsRelations = relations(mcqOptions, ({ one, many }) => ({
  question: one(mcqQuestions, {
    fields: [mcqOptions.questionId],
    references: [mcqQuestions.questionId],
  }),
  responses: many(mcqResponses)
}));

export const mcqResponses = pgTable('mcq_responses', {
  responseId: serial('response_id').primaryKey(),
  attemptId: integer('attempt_id').references(() => examAttempts.attemptId).notNull(),
  questionId: integer('question_id').references(() => mcqQuestions.questionId).notNull(),
  selectedOptionId: integer('selected_option_id').references(() => mcqOptions.optionId),
  submittedAt: timestamp('submitted_at').defaultNow()
});

export const mcqResponsesRelations = relations(mcqResponses, ({ one }) => ({
  attempt: one(examAttempts, {
    fields: [mcqResponses.attemptId],
    references: [examAttempts.attemptId],
  }),
  question: one(mcqQuestions, {
    fields: [mcqResponses.questionId],
    references: [mcqQuestions.questionId],
  }),
  selectedOption: one(mcqOptions, {
    fields: [mcqResponses.selectedOptionId],
    references: [mcqOptions.optionId],
  })
}));

export type McqQuestion = typeof mcqQuestions.$inferSelect;
export type NewMcqQuestion = typeof mcqQuestions.$inferInsert;
export type McqOption = typeof mcqOptions.$inferSelect;
export type NewMcqOption = typeof mcqOptions.$inferInsert;
export type McqResponse = typeof mcqResponses.$inferSelect;
export type NewMcqResponse = typeof mcqResponses.$inferInsert;

export const mcqQuestionSchema = createInsertSchema(mcqQuestions);
export const mcqQuestionSchemaSelect = createSelectSchema(mcqQuestions);
export const mcqOptionSchema = createInsertSchema(mcqOptions);
export const mcqOptionSchemaSelect = createSelectSchema(mcqOptions);
export const mcqResponseSchema = createInsertSchema(mcqResponses);
export const mcqResponseSchemaSelect = createSelectSchema(mcqResponses);
