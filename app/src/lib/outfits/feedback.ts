// Feedback on outfits and pieces: what it says about the style profile, and the day-based rules.
import type { StyleProfile } from "@/lib/style/profile";
import type { Piece } from "./filter";

// Garment colors in the profile's palette terms; a color can lean two ways (camel: earth + neutral).
const PALETTE: Record<string, string[]> = {
  black: ["dark"], white: ["neutral"], cream: ["neutral"], beige: ["neutral", "earth"], camel: ["earth", "neutral"],
  brown: ["earth"], grey: ["neutral"], charcoal: ["dark"], navy: ["dark"], blue: ["bright"], "light-blue": ["pastel"],
  teal: ["bright"], green: ["bright"], olive: ["earth"], khaki: ["earth"], red: ["bright"], burgundy: ["dark"],
  pink: ["pastel"], purple: ["bright"], yellow: ["bright"], orange: ["bright"], gold: ["earth"], silver: ["neutral"],
  multicolor: ["bright"],
};
const MONOCHROME = new Set(["black", "white", "grey", "charcoal"]);
const PATTERN: Record<string, string> = {
  solid: "solid", striped: "subtle", checked: "subtle", textured: "subtle", geometric: "subtle",
  plaid: "bold", floral: "bold", "polka-dot": "bold", "animal-print": "bold", graphic: "bold",
  paisley: "bold", camouflage: "bold", colorblock: "bold",
};

export type OutfitStyle = { palette: Record<string, number>; pattern: Record<string, number>; formality: number };

/** Normalized so one outfit weighs as much as one onboarding pick. */
function normalize(d: Record<string, number>): Record<string, number> {
  const total = Object.values(d).reduce((a, b) => a + b, 0);
  return total ? Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v / total])) : {};
}

/** What a set of pieces says in profile terms (palette, pattern, formality). */
export function styleOf(pieces: Piece[]): OutfitStyle {
  const palette: Record<string, number> = {};
  const pattern: Record<string, number> = {};
  for (const p of pieces) {
    for (const color of p.colors) {
      const leans = PALETTE[color] ?? [];
      for (const lean of leans) palette[lean] = (palette[lean] ?? 0) + 1 / p.colors.length / leans.length;
    }
    const kind = PATTERN[p.pattern];
    if (kind) pattern[kind] = (pattern[kind] ?? 0) + 1;
  }
  const colors = pieces.flatMap((p) => p.colors);
  if (colors.length && colors.every((c) => MONOCHROME.has(c))) palette.monochrome = (palette.monochrome ?? 0) + 1;
  const formality = pieces.length ? Math.round(pieces.reduce((a, p) => a + p.formality, 0) / pieces.length) : 3;
  return { palette: normalize(palette), pattern: normalize(pattern), formality };
}

/** A new profile nudged toward (+1) or away from (-1) these pieces' style. Scores never go below 0. */
export function applyFeedback(profile: StyleProfile, pieces: Piece[], sign: 1 | -1 | -0.5): StyleProfile {
  const style = styleOf(pieces);
  const nudge = (current: Record<string, number>, delta: Record<string, number>) => {
    const next = { ...current };
    for (const [k, v] of Object.entries(delta)) next[k] = Math.max(0, (next[k] ?? 0) + sign * v);
    return next;
  };
  return {
    ...profile,
    scores: { ...profile.scores, palette: nudge(profile.scores.palette, style.palette), pattern: nudge(profile.scores.pattern, style.pattern) },
    // only likes move the formality lean; a dislike doesn't say which way to move
    formality: sign > 0 ? { sum: profile.formality.sum + style.formality, count: profile.formality.count + 1 } : profile.formality,
  };
}

/** "Not today" lasts for the user's own calendar day (their phone's date, not the server's). */
export const isAvailableOn = (g: { notTodayOn: string | null }, today: string) => g.notTodayOn !== today;

export function isLocalDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

/** The same set of pieces, in any order, was worn recently. */
export function isRepeat(ids: string[], recent: string[][]): boolean {
  const key = [...ids].sort().join();
  return recent.some((r) => [...r].sort().join() === key);
}
