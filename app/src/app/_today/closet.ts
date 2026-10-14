// Shared server-side helpers for outfit actions (Today, fitting room). Not a "use server" module: nothing here is callable from the browser.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { garments } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { TEMPS, type Piece, type Weather } from "@/lib/outfits/filter";
import { signedGetUrl } from "@/lib/r2";

export const MAX_ACTIVITY = 80;
const MAX_OUTFIT_PIECES = 12;

export type OutfitPiece = { id: string; name: string; category: string; imageUrl: string };
export type Outfit = { pieces: OutfitPiece[]; why: string };

export const SESSION_EXPIRED = "Your session expired. Reload and sign in again.";
export const FAILED = "Something went wrong. Try again.";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isWeather = (w: unknown): w is Weather =>
  typeof w === "object" && w !== null && TEMPS.includes((w as Weather).temp) && typeof (w as Weather).rain === "boolean";
export const isActivity = (a: unknown): a is string => typeof a === "string" && !!a.trim() && a.trim().length <= MAX_ACTIVITY;
export const isIdList = (ids: unknown): ids is string[] =>
  Array.isArray(ids) && ids.length > 0 && ids.length <= MAX_OUTFIT_PIECES && ids.every((id) => typeof id === "string" && UUID.test(id));

export async function signedIn(): Promise<boolean> {
  try {
    await requireAuth();
    return true;
  } catch {
    return false;
  }
}

export type ClosetPiece = Piece & { imageKey: string; notTodayOn: string | null; status: string };

/** The user's active garments, as the outfit engine sees them; withRetired also returns retired ones. */
export async function activeCloset(userId: string, withRetired = false): Promise<ClosetPiece[]> {
  return db.select({
    id: garments.id, name: garments.name, category: garments.category, subcategory: garments.subcategory,
    colors: garments.colors, pattern: garments.pattern, material: garments.material,
    formality: garments.formality, warmth: garments.warmth, imageKey: garments.imageKey, notTodayOn: garments.notTodayOn, status: garments.status,
  }).from(garments).where(and(eq(garments.userId, userId), inArray(garments.status, withRetired ? ["active", "retired"] : ["active"])));
}

export async function toOutfitPiece(p: ClosetPiece): Promise<OutfitPiece> {
  return { id: p.id, name: p.name, category: p.category, imageUrl: await signedGetUrl(p.imageKey) };
}
