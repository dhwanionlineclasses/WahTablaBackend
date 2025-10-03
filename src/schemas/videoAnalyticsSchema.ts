import { z } from "zod";

// Base schema without refine
const baseVideoAnalyticsSchema = z.object({
  userId: z.number().int().positive(),
  videoId: z.number().int(),
  videoName: z.string().min(1).max(255),

  playCount: z.number().int().min(0).default(0),
  pauseCount: z.number().int().min(0).default(0),
  seekCount: z.number().int().min(0).default(0),

  watchedSeconds: z.number().int().min(0),
  totalVideoDuration: z.number().int().positive(),

  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),   // ✅ now optional & nullable

  durationSeconds: z.number().int().positive(),
  watchProgress: z.number().int().min(0).max(100),
  fullyWatched: z.boolean().default(false),
  isExam: z.boolean().default(false),
  examId: z.number().int().nullable(),
  yearId: z.number().int(),
  courseId: z.number().int()
});

// Apply refinements on top of base
export const videoAnalyticsSchema = baseVideoAnalyticsSchema
  .refine(
    (data) => data.watchedSeconds <= data.totalVideoDuration,
    {
      message: "watchedSeconds cannot exceed totalVideoDuration",
      path: ["watchedSeconds"],
    }
  )
  .refine(
    (data) => !data.endDate || data.startDate <= data.endDate,  // ✅ safe check
    {
      message: "startDate must be before or equal to endDate",
      path: ["startDate"],
    }
  );

// ✅ For updates: make all fields optional
export const updateVideoAnalyticsSchema = baseVideoAnalyticsSchema.partial();

export type VideoAnalytics = z.infer<typeof videoAnalyticsSchema>;
export type UpdateVideoAnalytics = z.infer<typeof updateVideoAnalyticsSchema>;
