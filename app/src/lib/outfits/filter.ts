// Code-side outfit rules: which pieces fit today's activity and weather, and what makes an outfit complete.
// The model only styles what passes here, and its answers are checked against outfitProblems().
import STYLE_VOCAB from "@/lib/style/style-vocab.json";

export const TEMPS = ["hot", "warm", "mild", "cool", "cold"] as const;
export type Temp = (typeof TEMPS)[number];
export type Weather = { temp: Temp; rain: boolean };
export const DEFAULT_WEATHER: Weather = { temp: "mild", rain: false };

/** A garment as the outfit engine sees it. */
export type Piece = {
  id: string; name: string; category: string; subcategory: string;
  colors: string[]; pattern: string; material: string; formality: number; warmth: number;
};

const TARGET_WARMTH: Record<Temp, number> = { hot: 1, warm: 2, mild: 3, cool: 4, cold: 5 };
const FORMALITY: Record<string, [number, number]> = {
  office: [3, 4], outdoors: [1, 2], gym: [1, 1], "night out": [3, 4], formal: [4, 5], casual: [1, 3], travel: [1, 3],
};
const LOOSE_FORMALITY = new Set(["outerwear", "shoes", "bag", "accessory", "jewelry"]); // ±1 around the range
const COLD_TEMPS = new Set<Temp>(["cool", "cold"]);

/** Formality range for an activity; custom ones allow everything and leave it to the model. */
export function formalityRange(activity: string): [number, number] {
  return FORMALITY[activity.trim().toLowerCase()] ?? [1, 5];
}

const isCustom = (activity: string) => !STYLE_VOCAB.activities.includes(activity.trim().toLowerCase());
export const needsOuterwear = (w: Weather) => w.rain || COLD_TEMPS.has(w.temp);

function warmEnough(p: Piece, w: Weather): boolean {
  const target = TARGET_WARMTH[w.temp];
  if (p.warmth - target >= 2) return false; // too warm for today
  if (p.category === "outerwear") return true; // layers: warmth is checked on the outfit's warmest coat
  return target - p.warmth < 4; // drops only the extremes (shorts, tank tops, sandals in the cold)
}

/** In cool or cold weather, at least one coat has to be this warm. */
const warmCoat = (p: Piece, w: Weather) => p.category === "outerwear" && (!COLD_TEMPS.has(w.temp) || p.warmth >= TARGET_WARMTH[w.temp] - 1);

function formalEnough(p: Piece, [lo, hi]: [number, number]): boolean {
  const slack = LOOSE_FORMALITY.has(p.category) ? 1 : 0;
  return p.formality >= lo - slack && p.formality <= hi + slack;
}

/** Pieces that suit today's activity and weather. */
export function candidatesFor(pieces: Piece[], activity: string, w: Weather): Piece[] {
  const range = formalityRange(activity);
  const swimOk = isCustom(activity);
  return pieces.filter((p) => (p.category !== "swimwear" || swimOk) && warmEnough(p, w) && formalEnough(p, range));
}

const has = (pieces: Piece[], ...categories: string[]) => pieces.some((p) => categories.includes(p.category));

/** What the candidates can't cover, in words; empty when at least one complete outfit is possible. */
export function missingPieces(candidates: Piece[], w: Weather): string[] {
  const missing: string[] = [];
  if (!has(candidates, "dress", "one-piece", "swimwear")) {
    const top = has(candidates, "top"), bottom = has(candidates, "bottom");
    if (!top && !bottom) missing.push("a top and bottom (or a dress)");
    else if (!bottom) missing.push("a bottom (or a dress)");
    else if (!top) missing.push("a top (or a dress)");
  }
  if (!has(candidates, "shoes")) missing.push("shoes");
  if (needsOuterwear(w) && !candidates.some((p) => warmCoat(p, w))) {
    missing.push(COLD_TEMPS.has(w.temp) ? `a coat or jacket warm enough for ${w.temp} weather` : "a coat or jacket for the rain");
  }
  return missing;
}

/** Why an outfit isn't wearable as a whole; empty means it's complete. */
export function outfitProblems(pieces: Piece[], w: Weather): string[] {
  const count = (c: string) => pieces.filter((p) => p.category === c).length;
  const problems: string[] = [];
  const onePiece = count("dress") + count("one-piece") + count("swimwear");
  if (onePiece > 1 || count("bottom") > 1 || (onePiece && count("bottom"))) problems.push("more than one base outfit");
  if (!onePiece && !(count("top") && count("bottom"))) problems.push("needs a top and bottom, or a dress");
  if (count("top") > 3) problems.push("too many tops");
  if (count("shoes") !== 1) problems.push("needs exactly one pair of shoes");
  if (count("outerwear") > 2) problems.push("more than two outer layers");
  if (needsOuterwear(w) && !pieces.some((p) => warmCoat(p, w))) problems.push("needs a coat or jacket warm enough for today");
  if (new Set(pieces.map((p) => p.id)).size !== pieces.length) problems.push("repeats a piece");
  return problems;
}
