// Buy list, code side: what the closet can't cover, per activity and weather. No API calls.
import { candidatesFor, fitsActivity, missingPieces, TEMPS, type Piece, type Weather } from "@/lib/outfits/filter";

const FEW_OUTFITS = 3; // fewer complete outfits than this for an activity counts as a gap
const WEATHERS: Weather[] = [...TEMPS.map((temp) => ({ temp, rain: false })), { temp: "mild", rain: true }];

export type Gap =
  | { kind: "missing"; activity: string; need: string; weathers: string[] } // no complete outfit at all in these weathers
  | { kind: "few"; activity: string; outfits: number }; // possible, but little choice

const describe = (w: Weather) => (w.rain ? "rain" : w.temp);

/** Complete outfits (top + bottom, or a dress, plus shoes) these pieces can make. */
export function countOutfits(pieces: Piece[]): number {
  const n = (...c: string[]) => pieces.filter((p) => c.includes(p.category)).length;
  return (n("top") * n("bottom") + n("dress", "one-piece", "swimwear")) * n("shoes");
}

/** Gaps per activity: missing pieces (grouped by what's missing, with the weathers it blocks) and activities with little choice. */
export function findGaps(closet: Piece[], activities: string[]): Gap[] {
  return activities.flatMap((activity) => {
    const needs = new Map<string, string[]>();
    for (const w of WEATHERS) {
      for (const need of missingPieces(candidatesFor(closet, activity, w), w)) needs.set(need, [...(needs.get(need) ?? []), describe(w)]);
    }
    const missing: Gap[] = [...needs].map(([need, weathers]) => ({ kind: "missing", activity, need, weathers }));
    const outfits = countOutfits(closet.filter((p) => fitsActivity(p, activity)));
    return outfits > 0 && outfits < FEW_OUTFITS ? [...missing, { kind: "few", activity, outfits }] : missing;
  });
}

/** One gap in plain words for the prompt and the page. */
export const gapText = (g: Gap): string =>
  g.kind === "missing"
    ? `${g.activity}: needs ${g.need} (${g.weathers.length === WEATHERS.length ? "any weather" : g.weathers.join(", ")})`
    : `${g.activity}: only ${g.outfits} complete ${g.outfits === 1 ? "outfit" : "outfits"}`;
