// "Colors that suit you": self-reported, never read from a photo. Feeds the style line every prompt uses.
import VOCAB from "@/lib/catalog/garment-tags.json";

export const UNDERTONES = ["warm", "cool", "neutral", "not sure"] as const;
export const COLOR_SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export const MAX_SUITS = 6;
export const MAX_AVOID = 4;

export type Coloring = {
  undertone: (typeof UNDERTONES)[number];
  season: (typeof COLOR_SEASONS)[number] | null; // from a color analysis, if they've had one
  suits: string[]; // garment colors that suit them near the face
  avoid: string[]; // colors to keep away from the face
};

const isColorList = (v: unknown, max: number): v is string[] =>
  Array.isArray(v) && v.length <= max && new Set(v).size === v.length && Array.from(v).every((c) => VOCAB.colors.includes(c));

/** What's wrong with a coloring answer from the client, or null if it's valid. */
export function coloringProblem(c: Coloring | null | undefined): string | null {
  if (c == null) return null; // skipped (or an older client that never sent it)
  if (typeof c !== "object") return "Invalid colors";
  if (!UNDERTONES.includes(c.undertone)) return "Pick an undertone";
  if (c.season != null && !COLOR_SEASONS.includes(c.season)) return "Unknown color season";
  if (!isColorList(c.suits, MAX_SUITS)) return `Pick up to ${MAX_SUITS} colors that suit you`;
  if (!isColorList(c.avoid, MAX_AVOID)) return `Pick up to ${MAX_AVOID} colors to avoid`;
  if (c.suits.some((s) => c.avoid.includes(s))) return "A color can't both suit you and be avoided";
  return null;
}

/** Only the known fields, so nothing else the client sent is stored; null when there's nothing to say. */
export function cleanColoring(c: Coloring | null | undefined): Coloring | null {
  if (!c) return null;
  const clean: Coloring = { undertone: c.undertone, season: c.season ?? null, suits: [...c.suits], avoid: [...c.avoid] };
  return isEmptyColoring(clean) ? null : clean;
}

/** Drops stored colors that are no longer in the vocabulary, so the form can always be saved again. */
export const knownColors = (c: Coloring | null): Coloring | null =>
  c && { ...c, suits: c.suits.filter((x) => VOCAB.colors.includes(x)), avoid: c.avoid.filter((x) => VOCAB.colors.includes(x)) };

/** True when the answer says nothing (all "not sure" / empty): stored as null. */
export const isEmptyColoring = (c: Coloring) => c.undertone === "not sure" && !c.season && !c.suits.length && !c.avoid.length;

/** The coloring in one prompt line, or null when there's nothing to say. */
export function coloringLine(c: Coloring | null | undefined): string | null {
  if (!c || isEmptyColoring(c)) return null;
  const parts = [
    c.undertone !== "not sure" && `${c.undertone} undertone`,
    c.season && `${c.season} color season`,
    c.suits.length && `colors that suit them: ${c.suits.join(", ")}`,
    c.avoid.length && `colors to avoid near the face: ${c.avoid.join(", ")}`,
  ].filter(Boolean);
  return `Coloring: ${parts.join("; ")}. Prefer suiting colors on tops and outer layers near the face; avoided colors only on bottoms and shoes.`;
}
