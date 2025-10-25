import { z } from "zod";

export const getExamSchema = z.object({
  courseId: z.string().transform(Number),
  yearId: z.string().transform(Number),
  weekNumber: z.string().transform(Number),
  type: z.enum(['mcq', 'assignment', 'final'])
});

export const getEntranceExamSchema = z.object({
  courseId: z.string().transform(Number),
});

export const submitMcqSchema = z.object({
  examId: z.number(),
  responses: z.array(z.object({
    questionId: z.number(),
    selectedOptionId: z.number()
  }))
});

export const submitAssignmentSchema = z.object({
  examId: z.number(),
  submissions: z.array(z.object({
    questionId: z.number().optional(),
    submissionType: z.enum(['text', 'link']),
    textAnswer: z.string().optional(),
    linkUrl: z.string().url().optional(),
    notes: z.string().optional()
  }))
});

export const submitFinalExamSchema = z.object({
  examId: z.number(),
  linkUrl: z.string().url('Please provide a valid URL'),
  notes: z.string().optional()
});
