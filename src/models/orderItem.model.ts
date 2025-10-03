import { pgTable, serial, integer, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { orders } from './order.model';
import { courses } from './course.model';
import { years } from './year.model';
import { modules } from './module.model';
import { months } from './month.model';

export const orderItems = pgTable('order_items', {
  orderItemId: serial('order_item_id').primaryKey(),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.orderId),
  itemType: varchar('item_type', { length: 20 }).notNull(),
  itemName: varchar('item_name', { length: 255 }).notNull(),
  // itemId: integer('item_id').notNull(),
});

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.orderId],
  }),
  course: one(courses, {
    fields: [orderItems.itemName],
    references: [courses.courseName],
  }),
  year: one(years, {
    fields: [orderItems.itemName],
    references: [years.yearName],
  }),
  module: one(modules, {
    fields: [orderItems.itemName],
    references: [modules.moduleName],
  }),
  month: one(months, {
    fields: [orderItems.itemName],
    references: [months.monthName],
  })
}));

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export const orderItemSchema = createInsertSchema(orderItems);
