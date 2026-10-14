import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Weather } from "@/lib/outfits/filter";
import type { BuyList } from "@/lib/lists/buy";
import type { Trip } from "@/lib/trip/capsule";
import type { StyleProfile } from "@/lib/style/profile";

// SPEC.md §4. Only the tables Stage 3 needs; later stages add theirs.

export const garmentStatus = pgEnum("garment_status", ["active", "retired", "deleted"]) // deleted = tombstone so re-imports skip it;
export const garmentSource = pgEnum("garment_source", ["video", "photo", "single_add"]);
export const retireReason = pgEnum("retire_reason", ["dislike", "no_longer_owned", "other"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  age: integer("age"),
  stylePreference: text("style_preference"), // free-form wardrobe conventions, not a gender switch
  conventions: text("conventions").array().notNull().default(sql`'{}'::text[]`), // menswear / womenswear, any mix
  styleProfile: jsonb("style_profile").$type<StyleProfile>(), // raw scores; summarize() for the readable view
  activities: text("activities").array().notNull().default(sql`'{}'::text[]`), // the daily-outfit buttons
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  weather: jsonb("weather").$type<Weather>(), // set by hand on the home screen; null = mild, dry
  buyList: jsonb("buy_list").$type<BuyList>(), // the last generated buy list; regenerated on request
  trip: jsonb("trip").$type<Trip>(), // the current packing plan and what's ticked off; a new trip replaces it
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
    notTodayOn: date("not_today_on"), // "not today": hidden on this local date only, back the next day
    keptUntil: date("kept_until"), // "keep" on the sell-or-donate list: not suggested again before this date
  },
  (t) => [uniqueIndex("garments_import_item").on(t.importId, t.importItemId)],
);

export type Garment = typeof garments.$inferSelect;

export const outfitEventKind = pgEnum("outfit_event_kind", ["wore", "like", "dislike"]);

/** Outfit history and feedback: what was worn, liked or disliked, on the user's local date. */
export const outfitEvents = pgTable(
  "outfit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: outfitEventKind("kind").notNull(),
    garmentIds: uuid("garment_ids").array().notNull(),
    activity: text("activity").notNull(),
    localDate: date("local_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("outfit_events_user_date").on(t.userId, t.localDate)],
);
