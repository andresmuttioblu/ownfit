import { sql } from "drizzle-orm";
import { boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// SPEC.md §4. Only the tables Stage 3 needs; later stages add theirs.

export const garmentStatus = pgEnum("garment_status", ["active", "retired", "deleted"]) // deleted = tombstone so re-imports skip it;
export const garmentSource = pgEnum("garment_source", ["video", "photo", "single_add"]);
export const retireReason = pgEnum("retire_reason", ["dislike", "no_longer_owned", "other"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  age: integer("age"),
  stylePreference: text("style_preference"), // free-form wardrobe conventions, not a gender switch
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const garments = pgTable(
  "garments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    imageKey: text("image_key").notNull(), // R2 object key of the clean, white-background image
    sourceImageKey: text("source_image_key"), // R2 key of the original crop / photo
    category: text("category").notNull(),
    subcategory: text("subcategory").notNull(),
    colors: text("colors").array().notNull(),
    pattern: text("pattern").notNull(),
    material: text("material").notNull(),
    formality: integer("formality").notNull(),
    seasons: text("seasons").array().notNull(),
    warmth: integer("warmth").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    status: garmentStatus("status").notNull().default("active"),
    source: garmentSource("source").notNull(),
    needsReview: boolean("needs_review").notNull().default(false),
    importId: text("import_id"), // with importItemId: makes re-running an upload idempotent
    importItemId: text("import_item_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    retireReason: retireReason("retire_reason"),
  },
  (t) => [uniqueIndex("garments_import_item").on(t.importId, t.importItemId)],
);

export type Garment = typeof garments.$inferSelect;
