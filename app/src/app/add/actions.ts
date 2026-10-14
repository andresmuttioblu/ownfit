"use server";

import { db } from "@/db";
import { garments } from "@/db/schema";
import { currentUser } from "@/db/user";
import { requireAuth } from "@/lib/auth";
import { validateTags, type GarmentTags } from "@/lib/catalog/vocabulary";
import { and, eq } from "drizzle-orm";
import { unlocks, type Unlock } from "@/lib/outfits/filter";
import STYLE_VOCAB from "@/lib/style/style-vocab.json";
import { deleteObject, objectExists } from "@/lib/r2";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = ["name", "category", "subcategory", "colors", "pattern", "material", "formality", "warmth", "seasons", "tags"] as const;

export type AddResult = { ok: true; garmentId: string; unlocks: Unlock[] } | { ok: false; error: string };

const keys = (draftId: string) => ({ image: `garments/single/${draftId}.png`, source: `sources/single/${draftId}.jpg` });

/** Adds the confirmed draft to the catalog. The images were stored when the draft was created. */
export async function confirmDraft(draftId: string, input: GarmentTags): Promise<AddResult> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Your session expired. Reload and sign in again." };
  }
  if (typeof draftId !== "string" || !UUID.test(draftId)) return { ok: false, error: "Invalid draft" };
  if (typeof input !== "object" || input === null || FIELDS.some((f) => input[f] === undefined)) return { ok: false, error: "Fill in every field" };
  const tags = Object.fromEntries(FIELDS.map((f) => [f, input[f]])) as GarmentTags;
  const errors = validateTags(tags);
  if (errors.length) return { ok: false, error: errors.join("; ") };
  try {
    if (!(await objectExists(keys(draftId).image))) return { ok: false, error: "This photo expired. Add it again." };
    const user = await currentUser();
    const { image, source } = keys(draftId);
    await db.insert(garments).values({
      ...tags, name: tags.name.trim(), userId: user.id, imageKey: image, sourceImageKey: source,
      source: "single_add", importId: "single", importItemId: draftId,
    }).onConflictDoNothing(); // a retried confirm whose first response was lost
    const closet = await db.select().from(garments).where(and(eq(garments.userId, user.id), eq(garments.status, "active")));
    const added = closet.find((g) => g.importId === "single" && g.importItemId === draftId);
    if (!added) return { ok: false, error: "Saving failed. Please try again." };
    const activities = user.activities.length ? user.activities : STYLE_VOCAB.activities;
    return { ok: true, garmentId: added.id, unlocks: unlocks(closet, added, activities) };
  } catch (e) {
    console.error("confirm draft failed", e);
    return { ok: false, error: "Saving failed. Please try again." };
  }
}

/** The user cancelled: remove the stored images. */
export async function discardDraft(draftId: string): Promise<void> {
  try {
    await requireAuth();
    if (typeof draftId !== "string" || !UUID.test(draftId)) return;
    const [confirmed] = await db.select({ id: garments.id }).from(garments)
      .where(and(eq(garments.importId, "single"), eq(garments.importItemId, draftId)));
    if (confirmed) return; // already in the catalog (double tap, stale tab): keep its images
    const { image, source } = keys(draftId);
    await Promise.all([deleteObject(image), deleteObject(source)]);
  } catch (e) {
    console.error("discard draft failed", e); // ponytail: an orphaned draft image is harmless; no sweeper yet
  }
}
