import { pgTable, serial, varchar, text, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema,createSelectSchema } from 'drizzle-zod';
import { months } from './month.model';

export const videos = pgTable('videos', {
  videoId: serial('video_id').primaryKey(),
  monthId: integer('month_id')
    .notNull()
    .references(() => months.monthId),
  videoVimeoId: varchar('video_vimeo_id', { length: 255 }).notNull(),
  videoTitle: varchar('video_title', { length: 255 }).notNull(),
  videoUrl: varchar('video_url', { length: 255 }).notNull(),
  description: text('description'),
  duration: integer('duration'),
  thumbnailUrl: varchar('thumbnail_url', { length: 255 }),
});

export const videosRelations = relations(videos, ({ one }) => ({
  month: one(months, {
    fields: [videos.monthId],
    references: [months.monthId],
  }),
}));

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;

export const videoSchema = createInsertSchema(videos);
export const videoSchemaSelect = createSelectSchema(videos);
