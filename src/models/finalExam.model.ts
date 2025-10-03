// models/finalExam.model.ts
import { pgTable, serial, integer, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { exams } from './exam.model';

export const finalExamSections = pgTable('final_exam_sections', {
  sectionId: serial('section_id').primaryKey(),
  examId: integer('exam_id').references(() => exams.examId).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  marks: integer('marks').notNull(),
  instructions: text('instructions'),
  sectionOrder: integer('section_order').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const finalExamQuestions = pgTable('final_exam_questions', {
  questionId: serial('question_id').primaryKey(),
  sectionId: integer('section_id').references(() => finalExamSections.sectionId).notNull(),
  examId: integer('exam_id').references(() => exams.examId).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'objective', 'short-answer', 'composition', 'long-answer'
  text: text('text').notNull(),
  questionOrder: integer('question_order').notNull(),
  marks: integer('marks').notNull(),
  isCompulsory: boolean('is_compulsory').default(false),
  requiresDiagram: boolean('requires_diagram').default(false),
  requiresMatching: boolean('requires_matching').default(false),
  requiresNotation: boolean('requires_notation').default(false),
  requiresVariations: boolean('requires_variations').default(false),
  requiresTihayi: boolean('requires_tihayi').default(false),
  requiresBiography: boolean('requires_biography').default(false),
  requiresDefinition: boolean('requires_definition').default(false),
  requiresExamples: boolean('requires_examples').default(false),
  matchingPairs: text('matching_pairs'), // JSON string for matching pairs
  createdAt: timestamp('created_at').defaultNow()
});

export const finalExamSectionsRelations = relations(finalExamSections, ({ one, many }) => ({
  exam: one(exams, {
    fields: [finalExamSections.examId],
    references: [exams.examId],
  }),
  questions: many(finalExamQuestions)
}));

export const finalExamQuestionsRelations = relations(finalExamQuestions, ({ one }) => ({
  section: one(finalExamSections, {
    fields: [finalExamQuestions.sectionId],
    references: [finalExamSections.sectionId],
  }),
  exam: one(exams, {
    fields: [finalExamQuestions.examId],
    references: [exams.examId],
  })
}));

export type FinalExamSection = typeof finalExamSections.$inferSelect;
export type NewFinalExamSection = typeof finalExamSections.$inferInsert;
export type FinalExamQuestion = typeof finalExamQuestions.$inferSelect;
export type NewFinalExamQuestion = typeof finalExamQuestions.$inferInsert;
