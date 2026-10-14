// Travel capsule: code picks what can go, Haiku plans the days from it, code checks every day and repairs the ones that don't hold.
import { candidatesFor, missingPieces, needsOuterwear, outfitProblems, type Piece, type Weather } from "@/lib/outfits/filter";
import { apiError, ask, styleLine } from "@/lib/outfits/style";
import { countOutfits } from "@/lib/lists/gaps";
import type { StyleSummary } from "@/lib/style/profile";
import type { Source } from "./weather";

const MAX_PIECES = 80; // prompt size bound, as on Today
const MAX_WHY = 160;

export type TripDay = { date: string; weather: Weather; activity: string };
export type PlannedDay = TripDay & { pieces: string[]; why: string; missing: string[] }; // missing: why the day has no outfit
export type Trip = {
  destination: string; place: string | null; source: Source | null; generatedAt: string;
  days: PlannedDay[]; capsule: string[]; outfits: number; packed: string[];
};
export type Plan = { days: PlannedDay[]; capsule: string[]; outfits: number };
export type CapsuleResult = ({ ok: true } & Plan) | { ok: false; error: string };

const SYSTEM = `You are a personal stylist packing a small travel capsule from the person's own closet.
You get the days of the trip (activity and weather each day), the person's style, and a numbered list of pieces that can go. Use only those numbers.
Plan one outfit per day. Each outfit needs a top and a bottom, or a dress / one-piece; exactly one pair of shoes; a coat or jacket when the day is cold, cool or rainy. At most one bottom, up to two outer layers.
Pack light: reuse the same bottoms, shoes and outer layers across days, and pick pieces that mix with each other, so few pieces make many outfits. Vary tops where you can.
Each "why" is one short sentence in plain words.`;

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["days"],
  properties: {
    days: { type: "array", items: { type: "object", additionalProperties: false, required: ["pieces", "why"],
      properties: { pieces: { type: "array", items: { type: "integer" } }, why: { type: "string" } } } },
  },
};

const byPreference = (keep: Set<string>) => (a: Piece, b: Piece) => Number(keep.has(b.id)) - Number(keep.has(a.id));

/** A valid outfit for the day from the candidates, reusing packed pieces first; null when there isn't one. */
export function dressDay(candidates: Piece[], w: Weather, packed: Set<string>): Piece[] | null {
  const sorted = [...candidates].sort(byPreference(packed));
  const first = (...cats: string[]) => sorted.find((p) => cats.includes(p.category));
  const top = first("top"), bottom = first("bottom"), dress = first("dress", "one-piece", "swimwear"), shoes = first("shoes");
  const base = top && bottom ? [top, bottom] : dress ? [dress] : null;
  if (!base || !shoes) return null;
  const outfit = [...base, shoes];
  if (!needsOuterwear(w)) return outfit;
  const coats = sorted.filter((p) => p.category === "outerwear");
  const coat = coats.find((c) => !outfitProblems([...outfit, c], w).length);
  return coat ? [...outfit, coat] : null;
}

type Answer = { days: { pieces: number[]; why: string }[] };

/** Every day checked against its own activity and weather; a day that fails gets the code's own outfit, or says what's missing. */
export function planDays(answer: Answer, pool: Piece[], days: TripDay[]): Plan {
  const fits = days.map((day) => candidatesFor(pool, day.activity, day.weather));
  const valid = days.map((day, i) => {
    const chosen = answer.days[i]?.pieces.map((n) => pool[n]);
    return chosen && chosen.every((p) => p && fits[i].includes(p)) && !outfitProblems(chosen, day.weather).length ? chosen : null;
  });
  const packed = new Set(valid.flatMap((o) => o ?? []).map((p) => p.id)); // repairs reuse anything the good days already pack
  const planned = days.map((day, i): PlannedDay => {
    const outfit = valid[i] ?? dressDay(fits[i], day.weather, packed);
    if (!outfit) return { ...day, pieces: [], why: "", missing: missingPieces(fits[i], day.weather) };
    outfit.forEach((p) => packed.add(p.id));
    return { ...day, pieces: outfit.map((p) => p.id), why: valid[i] ? (answer.days[i]?.why ?? "").trim().slice(0, MAX_WHY) : "", missing: [] };
  });
  return { days: planned, capsule: [...packed], outfits: countOutfits(pool.filter((p) => packed.has(p.id))) };
}

/** The pieces that suit at least one day of the trip. */
export const tripPool = <T extends Piece>(closet: T[], days: TripDay[]): T[] =>
  closet.filter((p) => days.some((d) => candidatesFor([p], d.activity, d.weather).length)).slice(0, MAX_PIECES);

export async function packCapsule(closet: Piece[], days: TripDay[], destination: string, profile: StyleSummary | null): Promise<CapsuleResult> {
  const pool = tripPool(closet, days);
  if (!process.env.ANTHROPIC_API_KEY) return { ok: true, ...planDays({ days: [] }, pool, days) }; // the code's plan still works
  const user = [
    `Trip to ${destination}, ${days.length} ${days.length === 1 ? "day" : "days"}:`,
    ...days.map((d, i) => `Day ${i + 1}: ${d.activity}, ${d.weather.temp}${d.weather.rain ? ", rain" : ""}`),
    styleLine(profile),
    "Pieces:",
    ...pool.map((p, i) => `${i}. ${p.name} | ${p.category}/${p.subcategory} | ${p.colors.join("+")} | ${p.pattern} | formality ${p.formality} | warmth ${p.warmth}`),
  ].join("\n");
  try {
    return { ok: true, ...planDays(await ask<Answer>(SYSTEM, user, SCHEMA), pool, days) };
  } catch (e) {
    const known = apiError(e);
    if (known) return { ok: false, error: known };
    console.error("trip capsule failed", e);
    return { ok: true, ...planDays({ days: [] }, pool, days) }; // fall back to the code's plan rather than nothing
  }
}
