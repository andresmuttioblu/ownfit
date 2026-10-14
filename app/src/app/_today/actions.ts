"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { garments, users } from "@/db/schema";
import { currentUser } from "@/db/user";
import { requireAuth } from "@/lib/auth";
import { candidatesFor, missingPieces, TEMPS, type Weather } from "@/lib/outfits/filter";
import { suggestOutfits } from "@/lib/outfits/style";
import { signedGetUrl } from "@/lib/r2";
import { hourlyLimiter } from "@/lib/upload";
import { summarize } from "@/lib/style/profile";

const MAX_ACTIVITY = 80;
const overLimit = hourlyLimiter(60); // the Anthropic spend limit is the real cap

export type OutfitPiece = { id: string; name: string; category: string; imageUrl: string };
export type TodayResult =
  | { kind: "outfits"; outfits: { pieces: OutfitPiece[]; why: string }[]; needs: string[]; ms: number }
  | { kind: "missing"; missing: string[]; activity: string; weather: Weather } // the closet can't make a complete outfit for this
  | { kind: "error"; error: string };

const isWeather = (w: unknown): w is Weather =>
  typeof w === "object" && w !== null && TEMPS.includes((w as Weather).temp) && typeof (w as Weather).rain === "boolean";

/** Outfits for one activity (a button, or free text from "something else") in the weather shown on screen. */
export async function outfitsFor(activity: string, weather: Weather): Promise<TodayResult> {
  const started = Date.now();
  try {
    await requireAuth();
  } catch {
    return { kind: "error", error: "Your session expired. Reload and sign in again." };
  }
  if (typeof activity !== "string" || !activity.trim() || activity.trim().length > MAX_ACTIVITY) {
    return { kind: "error", error: `Describe the activity in up to ${MAX_ACTIVITY} characters.` };
  }
  if (!isWeather(weather)) return { kind: "error", error: "Pick today's weather first." };
  if (overLimit()) return { kind: "error", error: "That's a lot of outfits in an hour. Try again later." };
  try {
    const user = await currentUser();
    const closet = await db.select({
      id: garments.id, name: garments.name, category: garments.category, subcategory: garments.subcategory,
      colors: garments.colors, pattern: garments.pattern, material: garments.material,
      formality: garments.formality, warmth: garments.warmth, imageKey: garments.imageKey,
    }).from(garments).where(and(eq(garments.userId, user.id), eq(garments.status, "active")));
    const candidates = candidatesFor(closet, activity, weather);
    const missing = missingPieces(candidates, weather);
    if (missing.length) return { kind: "missing", missing, activity: activity.trim(), weather };

    const result = await suggestOutfits(activity.trim(), weather, user.styleProfile ? summarize(user.styleProfile) : null, candidates);
    if (!result.ok) return { kind: "error", error: result.error };
    const keys = new Map(closet.map((g) => [g.id, g.imageKey]));
    const outfits = await Promise.all(result.outfits.map(async (o) => ({
      why: o.why,
      pieces: await Promise.all(o.pieces.map(async (p) => ({ id: p.id, name: p.name, category: p.category, imageUrl: await signedGetUrl(keys.get(p.id)!) }))),
    })));
    return { kind: "outfits", outfits, needs: result.needs, ms: Date.now() - started };
  } catch (e) {
    console.error("outfits failed", e);
    return { kind: "error", error: "Something went wrong. Try again." };
  }
}

/** Saves the weather the user set; it stays until they change it. */
export async function setWeather(weather: Weather): Promise<{ ok: boolean }> {
  try {
    await requireAuth();
    if (!isWeather(weather)) return { ok: false };
    const user = await currentUser();
    await db.update(users).set({ weather: { temp: weather.temp, rain: weather.rain } }).where(eq(users.id, user.id));
    return { ok: true };
  } catch (e) {
    console.error("set weather failed", e);
    return { ok: false };
  }
}
