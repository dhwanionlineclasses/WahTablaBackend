import { pgTable, serial, integer, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { users } from './user.model';
import { videos } from './video.model';
import { exams } from './exam.model'; // import your exams table
import { years } from './year.model';
import { courses } from './course.model';

export const videoAnalytics = pgTable('video_analytics', {
  analyticsId: serial('analytics_id').primaryKey(),

  userId: integer('user_id')
    .notNull()
    .references(() => users.userId),

  videoId: integer('video_id')
    .notNull()
    .references(() => videos.videoId),

  videoName: varchar('video_name', { length: 255 }).notNull(),

  playCount: integer('play_count').notNull().default(0),
  pauseCount: integer('pause_count').notNull().default(0),
  seekCount: integer('seek_count').notNull().default(0),

  watchedSeconds: integer('watched_seconds').notNull().default(0),
  totalVideoDuration: integer('total_video_duration').notNull(),

  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),

  durationSeconds: integer('duration_seconds').notNull(),
  watchProgress: integer('watch_progress').notNull(),
  fullyWatched: boolean('fully_watched').notNull().default(false),
  isAvailable: boolean('is_available').notNull().default(true),
  isExam: boolean('is_exam').notNull().default(false),

  // New field: examId, nullable unless isExam is true
  examId: integer('exam_id').references(() => exams.examId),
  yearId: integer('year_id'),
  courseId: integer('courseId')
});

export const videoAnalyticsRelations = relations(videoAnalytics, ({ one }) => ({
  user: one(users, {
    fields: [videoAnalytics.userId],
    references: [users.userId],
  }),
  video: one(videos, {
    fields: [videoAnalytics.videoId],
    references: [videos.videoId],
  }),
  exam: one(exams, {
    fields: [videoAnalytics.examId],
    references: [exams.examId],
  }),
}));

// Types
export type VideoAnalytics = typeof videoAnalytics.$inferSelect;
export type NewVideoAnalytics = typeof videoAnalytics.$inferInsert;

// Zod schema
export const videoAnalyticsSchema = createInsertSchema(videoAnalytics);
