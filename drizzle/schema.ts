import { pgTable, text, boolean, integer, real, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const stores = pgTable("stores", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  branch: text("branch").notNull().default(""),
  pinHash: text("pin_hash").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const submissions = pgTable(
  "submissions",
  {
    storeId: text("store_id").notNull(),
    isoWeek: text("iso_week").notNull(),
    totalOrders: integer("total_orders").notNull().default(0),
    pickingMin: real("picking_min").notNull().default(0),
    assignmentMin: real("assignment_min").notNull().default(0),
    fulfillmentRate: real("fulfillment_rate").notNull().default(0),
    compensationRate: real("compensation_rate").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.storeId, t.isoWeek] })],
);

export const performers = pgTable(
  "performers",
  {
    storeId: text("store_id").notNull(),
    isoWeek: text("iso_week").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default(""),
    quote: text("quote").notNull().default(""),
    badgeTitle: text("badge_title").notNull().default("HungerStation Market"),
    photo: text("photo"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.storeId, t.isoWeek] })],
);
