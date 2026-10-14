"use server";

import { and, eq, inArray } from "drizzle-orm";
import { FAILED, SESSION_EXPIRED, signedIn, UUID } from "@/app/_today/closet";
import { db } from "@/db";
import { garments } from "@/db/schema";
import { currentUser } from "@/db/user";
import { isLocalDate } from "@/lib/outfits/feedback";
import { keepUntil } from "@/lib/lists/let-go";

export type ListAction = { ok: true } | { ok: false; error: string };
const GONE = "That piece isn't in your closet any more.";

/** "Let it go": out of the closet for good; a later closet import skips it too. */
export async function letGo(garmentId: string): Promise<ListAction> {
  if (!(await signedIn())) return { ok: false, error: SESSION_EXPIRED };
  if (typeof garmentId !== "string" || !UUID.test(garmentId)) return { ok: false, error: FAILED };
  try {
    const user = await currentUser();
    const done = await db.update(garments).set({ status: "deleted", retiredAt: new Date() })
      .where(and(eq(garments.id, garmentId), eq(garments.userId, user.id), inArray(garments.status, ["active", "retired"])))
      .returning({ id: garments.id });
    return done.length ? { ok: true } : { ok: false, error: GONE };
  } catch (e) {
    console.error("let go failed", e);
    return { ok: false, error: FAILED };
  }
}

/** "Keep": not suggested here again for a year (from the phone's date). */
export async function keep(garmentId: string, today: string): Promise<ListAction> {
  if (!(await signedIn())) return { ok: false, error: SESSION_EXPIRED };
  if (typeof garmentId !== "string" || !UUID.test(garmentId) || !isLocalDate(today)) return { ok: false, error: FAILED };
  try {
    const user = await currentUser();
    const done = await db.update(garments).set({ keptUntil: keepUntil(today) })
      .where(and(eq(garments.id, garmentId), eq(garments.userId, user.id), inArray(garments.status, ["active", "retired"])))
      .returning({ id: garments.id });
    return done.length ? { ok: true } : { ok: false, error: GONE };
  } catch (e) {
    console.error("keep failed", e);
    return { ok: false, error: FAILED };
  }
}
