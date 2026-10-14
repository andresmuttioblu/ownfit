"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { garments, outfitEvents, users } from "@/db/schema";
import { currentUser } from "@/db/user";
import { requireAuth } from "@/lib/auth";
import { applyFeedback, isAvailableOn, isLocalDate } from "@/lib/outfits/feedback";
import { candidatesFor, missingPieces, outfitsWith, TEMPS, type Piece, type Weather } from "@/lib/outfits/filter";
import { suggestOutfits, swapPiece as styleSwap, type History } from "@/lib/outfits/style";
import { signedGetUrl } from "@/lib/r2";
import { hourlyLimiter } from "@/lib/upload";
import { summarize } from "@/lib/style/profile";

const MAX_ACTIVITY = 80;
const MAX_OUTFIT_PIECES = 12;
const REPEAT_DAYS = 7; // an outfit worn this recently isn't suggested again as-is
const FEEDBACK_IN_PROMPT = 10;
const overLimit = hourlyLimiter(60); // the Anthropic spend limit is the real cap

export type OutfitPiece = { id: string; name: string; category: string; imageUrl: string };
export type Outfit = { pieces: OutfitPiece[]; why: string };
export type TodayResult =
  | { kind: "outfits"; outfits: Outfit[]; needs: string[]; ms: number }
  | { kind: "missing"; missing: string[]; activity: string; weather: Weather } // the closet can't make a complete outfit for this
  | { kind: "error"; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };
export type SwapResult = { ok: true; piece: OutfitPiece } | { ok: false; error: string };

const SESSION_EXPIRED = "Your session expired. Reload and sign in again.";
const FAILED = "Something went wrong. Try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isWeather = (w: unknown): w is Weather =>
  typeof w === "object" && w !== null && TEMPS.includes((w as Weather).temp) && typeof (w as Weather).rain === "boolean";
const isActivity = (a: unknown): a is string => typeof a === "string" && !!a.trim() && a.trim().length <= MAX_ACTIVITY;
const isIdList = (ids: unknown): ids is string[] =>
  Array.isArray(ids) && ids.length > 0 && ids.length <= MAX_OUTFIT_PIECES && ids.every((id) => typeof id === "string" && UUID.test(id));

async function signedIn(): Promise<boolean> {
  try {
    await requireAuth();
    return true;
  } catch {
    return false;
  }
}

type ClosetPiece = Piece & { imageKey: string; notTodayOn: string | null; status: string };

/** The user's active garments, as the outfit engine sees them; withRetired also returns retired ones. */
async function activeCloset(userId: string, withRetired = false): Promise<ClosetPiece[]> {
  return db.select({
    id: garments.id, name: garments.name, category: garments.category, subcategory: garments.subcategory,
    colors: garments.colors, pattern: garments.pattern, material: garments.material,
    formality: garments.formality, warmth: garments.warmth, imageKey: garments.imageKey, notTodayOn: garments.notTodayOn, status: garments.status,
  }).from(garments).where(and(eq(garments.userId, userId), inArray(garments.status, withRetired ? ["active", "retired"] : ["active"])));
}

const daysBefore = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

/** Recently worn outfits and the latest likes and dislikes, as pieces still in the closet. */
async function historyFor(userId: string, today: string, byId: Map<string, Piece>): Promise<History> {
  const events = await db.select({ kind: outfitEvents.kind, garmentIds: outfitEvents.garmentIds, localDate: outfitEvents.localDate })
    .from(outfitEvents).where(eq(outfitEvents.userId, userId)).orderBy(desc(outfitEvents.createdAt)).limit(100);
  const pieces = (ids: string[]) => ids.map((id) => byId.get(id)).filter((p): p is Piece => !!p);
  const cutoff = daysBefore(today, REPEAT_DAYS - 1); // today and the 6 days before
  const worn = events.filter((e) => e.kind === "wore" && e.localDate >= cutoff);
  const feedback = events.filter((e) => e.kind !== "wore").slice(0, FEEDBACK_IN_PROMPT);
  return {
    wornIds: worn.map((e) => e.garmentIds),
    worn: worn.map((e) => pieces(e.garmentIds)).filter((o) => o.length),
    liked: feedback.filter((e) => e.kind === "like").map((e) => pieces(e.garmentIds)).filter((o) => o.length),
    disliked: feedback.filter((e) => e.kind === "dislike").map((e) => pieces(e.garmentIds)).filter((o) => o.length),
  };
}

/** Read-modify-write of the profile, re-read right before writing to keep the lost-update window small. */
async function nudgeProfile(userId: string, pieces: Piece[], sign: 1 | -1 | -0.5): Promise<void> {
  // ponytail: no row lock (neon-http has no interactive transactions); two taps within ms can drop one nudge
  const [row] = await db.select({ profile: users.styleProfile }).from(users).where(eq(users.id, userId));
  if (row?.profile) await db.update(users).set({ styleProfile: applyFeedback(row.profile, pieces, sign) }).where(eq(users.id, userId));
}

async function toOutfitPiece(p: ClosetPiece): Promise<OutfitPiece> {
  return { id: p.id, name: p.name, category: p.category, imageUrl: await signedGetUrl(p.imageKey) };
}

/** Outfits for one activity (a button, or free text from "something else") in the weather shown on screen, on the phone's date.
 *  mustInclude: every outfit has this piece (right after adding it). */
export async function outfitsFor(activity: string, weather: Weather, today: string, mustInclude?: string): Promise<TodayResult> {
  const started = Date.now();
  if (!(await signedIn())) return { kind: "error", error: SESSION_EXPIRED };
  if (!isActivity(activity)) return { kind: "error", error: `Describe the activity in up to ${MAX_ACTIVITY} characters.` };
  if (!isWeather(weather)) return { kind: "error", error: "Pick today's weather first." };
  if (!isLocalDate(today)) return { kind: "error", error: "Your phone's date looks wrong. Reload and try again." };
  if (mustInclude !== undefined && (typeof mustInclude !== "string" || !UUID.test(mustInclude))) return { kind: "error", error: FAILED };
  if (overLimit()) return { kind: "error", error: "That's a lot of outfits in an hour. Try again later." };
  try {
    const user = await currentUser();
    const closet = (await activeCloset(user.id)).filter((g) => isAvailableOn(g, today));
    let candidates = candidatesFor(closet, activity, weather);
    if (mustInclude) {
      const piece = candidates.find((p) => p.id === mustInclude);
      const weatherWords = `${weather.temp}${weather.rain ? ", rainy" : ""} weather`;
      if (!piece) return { kind: "error", error: `It doesn't suit ${activity.trim()} in ${weatherWords}.` };
      if (!outfitsWith(candidates, piece)) return { kind: "error", error: `It doesn't make a complete ${activity.trim()} outfit in ${weatherWords}.` };
      candidates = [piece, ...candidates.filter((p) => p !== piece)]; // first, so it's never cut from a long list
    }
    const missing = missingPieces(candidates, weather);
    if (missing.length) return { kind: "missing", missing, activity: activity.trim(), weather };

    const history = await historyFor(user.id, today, new Map(closet.map((g) => [g.id, g])));
    const profile = user.styleProfile ? summarize(user.styleProfile) : null;
    const result = await suggestOutfits(activity.trim(), weather, profile, candidates, history, mustInclude);
    if (!result.ok) return { kind: "error", error: result.error };
    const byId = new Map(closet.map((g) => [g.id, g]));
    const outfits = await Promise.all(result.outfits.map(async (o) => ({
      why: o.why,
      pieces: await Promise.all(o.pieces.map((p) => toOutfitPiece(byId.get(p.id)!))),
    })));
    return { kind: "outfits", outfits, needs: result.needs, ms: Date.now() - started };
  } catch (e) {
    console.error("outfits failed", e);
    return { kind: "error", error: FAILED };
  }
}

/** Another piece of the same category for this outfit, from what fits today and isn't set aside. */
export async function swapPiece(outfitIds: string[], outId: string, activity: string, weather: Weather, today: string): Promise<SwapResult> {
  if (!(await signedIn())) return { ok: false, error: SESSION_EXPIRED };
  if (!isIdList(outfitIds) || !outfitIds.includes(outId) || !isActivity(activity) || !isWeather(weather) || !isLocalDate(today)) {
    return { ok: false, error: "Couldn't swap that piece. Reload and try again." };
  }
  if (overLimit()) return { ok: false, error: "That's a lot of outfits in an hour. Try again later." };
  try {
    const user = await currentUser();
    const closet = await activeCloset(user.id, true); // includes the piece going out, even if it was just set aside or retired
    const byId = new Map(closet.map((g) => [g.id, g]));
    const active = new Set(closet.filter((g) => g.status === "active").map((g) => g.id));
    const outfit = outfitIds.map((id) => byId.get(id)).filter((p): p is ClosetPiece => !!p);
    const out = byId.get(outId);
    if (!out || outfit.length !== outfitIds.length) return { ok: false, error: "This outfit changed. Ask for new outfits." };
    const pool = candidatesFor(closet.filter((g) => active.has(g.id) && isAvailableOn(g, today)), activity, weather);
    const profile = user.styleProfile ? summarize(user.styleProfile) : null;
    const result = await styleSwap(outfit, out, pool, activity.trim(), weather, profile);
    if (!result.ok) return result;
    return { ok: true, piece: await toOutfitPiece(byId.get(result.piece.id)!) };
  } catch (e) {
    console.error("swap failed", e);
    return { ok: false, error: FAILED };
  }
}

/** "Not today": hides the piece until the phone's date changes. */
export async function notToday(garmentId: string, today: string): Promise<ActionResult> {
  if (!(await signedIn())) return { ok: false, error: SESSION_EXPIRED };
  if (typeof garmentId !== "string" || !UUID.test(garmentId) || !isLocalDate(today)) return { ok: false, error: FAILED };
  try {
    const user = await currentUser();
    const updated = await db.update(garments).set({ notTodayOn: today })
      .where(and(eq(garments.id, garmentId), eq(garments.userId, user.id), eq(garments.status, "active"))).returning({ id: garments.id });
    return updated.length ? { ok: true } : { ok: false, error: "That piece isn't in your closet any more." };
  } catch (e) {
    console.error("not today failed", e);
    return { ok: false, error: FAILED };
  }
}

const RETIRE_REASONS = ["dislike", "no_longer_owned"] as const;
type RetireReason = (typeof RETIRE_REASONS)[number];

/** Takes a piece out of rotation. "Don't like it" also nudges the style profile away from it. */
export async function retireGarment(garmentId: string, reason: RetireReason): Promise<ActionResult> {
  if (!(await signedIn())) return { ok: false, error: SESSION_EXPIRED };
  if (typeof garmentId !== "string" || !UUID.test(garmentId) || !RETIRE_REASONS.includes(reason)) return { ok: false, error: FAILED };
  try {
    const user = await currentUser();
    const [piece] = await db.update(garments).set({ status: "retired", retiredAt: new Date(), retireReason: reason })
      .where(and(eq(garments.id, garmentId), eq(garments.userId, user.id), eq(garments.status, "active"))).returning();
    if (!piece) return { ok: false, error: "That piece isn't in your closet any more." };
    if (reason === "dislike") await nudgeProfile(user.id, [piece], -0.5);
    return { ok: true };
  } catch (e) {
    console.error("retire failed", e);
    return { ok: false, error: FAILED };
  }
}

const EVENT_KINDS = ["wore", "like", "dislike"] as const;
type EventKind = (typeof EVENT_KINDS)[number];

/** "Wore this", 👍 or 👎 on an outfit: logged for history; likes and dislikes also move the style profile. */
export async function recordOutfit(kind: EventKind, garmentIds: string[], activity: string, today: string): Promise<ActionResult> {
  if (!(await signedIn())) return { ok: false, error: SESSION_EXPIRED };
  if (!EVENT_KINDS.includes(kind) || !isIdList(garmentIds) || !isActivity(activity) || !isLocalDate(today)) return { ok: false, error: FAILED };
  try {
    const user = await currentUser();
    const pieces = await db.select().from(garments)
      .where(and(eq(garments.userId, user.id), inArray(garments.id, garmentIds)));
    if (pieces.length !== new Set(garmentIds).size) return { ok: false, error: "This outfit changed. Ask for new outfits." };
    await db.insert(outfitEvents).values({ userId: user.id, kind, garmentIds, activity: activity.trim(), localDate: today });
    if (kind !== "wore") await nudgeProfile(user.id, pieces, kind === "like" ? 1 : -1);
    return { ok: true };
  } catch (e) {
    console.error("record outfit failed", e);
    return { ok: false, error: FAILED };
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
