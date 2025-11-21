import { pgTable, serial, integer, timestamp, decimal,varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { users } from './user.model';
import { orderItems } from './orderItem.model';

export const orders = pgTable('orders', {
  orderId: serial('order_id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.userId),
  orderDate: timestamp('order_date').defaultNow().notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  paymentStatus: varchar('payment_status', { length: 20 }).notNull(),
  paymentIntent: varchar('payment_intent', { length: 255 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('USD').notNull(),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.userId],
  }),
  orderItems: many(orderItems),
}));

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export const orderSchema = createInsertSchema(orders);
