"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { garments } from "@/db/schema";
import { currentUser } from "@/db/user";
import { requireAuth } from "@/lib/auth";
import { validateTags, type GarmentTags } from "@/lib/catalog/vocabulary";
import { deleteObject } from "@/lib/r2";

/** Errors whose message is safe and useful to show the user; anything else is reported generically. */
class UserError extends Error {}

export type ActionResult = { ok: true } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 500;
const PATCH_FIELDS = ["name", "category", "subcategory", "colors", "pattern", "material", "formality", "warmth", "seasons", "tags", "needsReview"] as const;
export type GarmentPatch = Partial<GarmentTags & { needsReview: boolean }>;

function checkIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS || !ids.every((id) => typeof id === "string" && UUID.test(id))) {
    throw new UserError("Invalid selection");
  }
  return ids;
}

function pickPatch(input: unknown): GarmentPatch {
  if (typeof input !== "object" || input === null) throw new UserError("Invalid edit");
  const patch = Object.fromEntries(Object.entries(input).filter(([k]) => (PATCH_FIELDS as readonly string[]).includes(k)));
  if (Object.keys(patch).length === 0) throw new UserError("Nothing to change");
  if ("needsReview" in patch && typeof patch.needsReview !== "boolean") throw new UserError("Invalid review flag");
  return patch as GarmentPatch;
}

/** Runs a catalog change for the signed-in user; every query below is scoped to their id. */
async function run(fn: (userId: string) => Promise<void>): Promise<ActionResult> {
  try {
    await requireAuth().catch(() => { throw new UserError("Your session expired. Reload and sign in again."); });
    await fn((await currentUser()).id);
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("catalog action failed", e);
    return { ok: false, error: e instanceof UserError ? e.message : "Something went wrong. Please try again." };
  }
}

/** Apply the same change to one or many garments. All rows are validated before any is written. */
export async function updateGarments(ids: string[], input: GarmentPatch): Promise<ActionResult> {
  return run(async (userId) => {
    const valid = checkIds(ids);
    const patch = pickPatch(input);
    const rows = await db.select().from(garments).where(and(inArray(garments.id, valid), eq(garments.userId, userId), ne(garments.status, "deleted")));
    const updates = rows.map((row) => {
      const merged = { ...row, ...patch };
      // A category change without a subcategory resets it to "other" so the pair stays valid.
      if (patch.category && !patch.subcategory && patch.category !== row.category) merged.subcategory = "other";
      const errors = validateTags(merged);
      if (errors.length) throw new UserError(`${row.name}: ${errors.join("; ")}`);
      return db.update(garments).set({
        ...patch, subcategory: merged.subcategory, ...(patch.name ? { name: patch.name.trim() } : {}),
      }).where(and(eq(garments.id, row.id), eq(garments.userId, userId)));
    });
    if (updates.length) await db.batch(updates as [typeof updates[number], ...typeof updates]); // one transaction
  });
}

/** Soft delete: the row stays as a tombstone (so re-running an upload doesn't bring it back); images go. */
async function removeGarments(userId: string, ids: string[]) {
  const rows = await db.update(garments).set({ status: "deleted" })
    .where(and(inArray(garments.id, ids), eq(garments.userId, userId), ne(garments.status, "deleted"))).returning();
  // Images go after the rows: a failed image delete leaves an orphan file, never a broken card.
  for (const key of rows.flatMap((r) => [r.imageKey, r.sourceImageKey])) {
    if (key) await deleteObject(key).catch((e) => console.error("orphaned image", key, e));
  }
}

export async function deleteGarments(ids: string[]): Promise<ActionResult> {
  return run((userId) => removeGarments(userId, checkIds(ids)));
}

/** Duplicates: keep one, delete the rest. */
export async function mergeGarments(keepId: string, ids: string[]): Promise<ActionResult> {
  return run(async (userId) => {
    const [keep] = checkIds([keepId]);
    const others = checkIds(ids).filter((id) => id !== keep);
    if (others.length === 0) throw new UserError("Select at least two items to merge");
    const [kept] = await db.update(garments).set({ needsReview: false })
      .where(and(eq(garments.id, keep), eq(garments.userId, userId), eq(garments.status, "active"))).returning({ id: garments.id });
    if (!kept) throw new UserError("The item to keep no longer exists. Reload and try again.");
    await removeGarments(userId, others);
  });
}
