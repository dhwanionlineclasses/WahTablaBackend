// models/mcq.model.ts
import { pgTable, serial, integer, varchar, boolean, timestamp, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { exams, entranceExamAttempts, entranceExams } from './exam.model';

export const entranceMcqQuestions = pgTable('entrance_mcq_questions', {
  questionId: serial('question_id').primaryKey(),
  examId: integer('exam_id').references(() => entranceExams.examId).notNull(),
  question: text('question').notNull(),
  questionOrder: integer('question_order').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const entranceMcqOptions = pgTable('entrance_mcq_options', {
  optionId: serial('option_id').primaryKey(),
  questionId: integer('question_id').references(() => entranceMcqQuestions.questionId).notNull(),
  optionText: varchar('option_text', { length: 512 }).notNull(),
  isCorrect: boolean('is_correct').default(false),
  optionOrder: integer('option_order').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const entranceMcqResponses = pgTable('entrance_mcq_responses', {
  responseId: serial('response_id').primaryKey(),
  attemptId: integer('attempt_id').references(() => entranceExamAttempts.attemptId).notNull(),
  questionId: integer('question_id').references(() => entranceMcqQuestions.questionId).notNull(),
  selectedOptionId: integer('selected_option_id').references(() => entranceMcqOptions.optionId),
  submittedAt: timestamp('submitted_at').defaultNow()
});

export const entranceMcqQuestionsRelations = relations(entranceMcqQuestions, ({ one, many }) => ({
  exam: one(entranceExams, {
    fields: [entranceMcqQuestions.examId],
    references: [entranceExams.examId],
  }),
  options: many(entranceMcqOptions),
  responses: many(entranceMcqResponses)
}));

export const entranceMcqOptionsRelations = relations(entranceMcqOptions, ({ one, many }) => ({
  question: one(entranceMcqQuestions, {
    fields: [entranceMcqOptions.questionId],
    references: [entranceMcqQuestions.questionId],
  }),
  responses: many(entranceMcqResponses)
}));

export const entranceMcqResponsesRelations = relations(entranceMcqResponses, ({ one }) => ({
  attempt: one(entranceExamAttempts, {
    fields: [entranceMcqResponses.attemptId],
    references: [entranceExamAttempts.attemptId],
  }),
  question: one(entranceMcqQuestions, {
    fields: [entranceMcqResponses.questionId],
    references: [entranceMcqQuestions.questionId],
  }),
  selectedOption: one(entranceMcqOptions, {
    fields: [entranceMcqResponses.selectedOptionId],
    references: [entranceMcqOptions.optionId],
  })
}));

export type EntranceMcqQuestion = typeof entranceMcqQuestions.$inferSelect;
export type EntranceNewMcqQuestion = typeof entranceMcqQuestions.$inferInsert;
export type EntranceMcqOption = typeof entranceMcqOptions.$inferSelect;
export type EntranceNewMcqOption = typeof entranceMcqOptions.$inferInsert;
export type EntranceMcqResponse = typeof entranceMcqResponses.$inferSelect;
export type EntranceNewMcqResponse = typeof entranceMcqResponses.$inferInsert;

export const entranceMcqQuestionSchema = createInsertSchema(entranceMcqQuestions);
export const entranceMcqQuestionSchemaSelect = createSelectSchema(entranceMcqQuestions);
export const entranceMcqOptionSchema = createInsertSchema(entranceMcqOptions);
export const entranceMcqOptionSchemaSelect = createSelectSchema(entranceMcqOptions);
export const entranceMcqResponseSchema = createInsertSchema(entranceMcqResponses);
export const entranceMcqResponseSchemaSelect = createSelectSchema(entranceMcqResponses);
