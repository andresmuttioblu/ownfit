// Onboarding style rounds: linked Unsplash photos, each with the style weights a pick adds.
import PRESETS from "./presets.json";
import type { StyleWeights } from "./profile";

export type Convention = "menswear" | "womenswear";
export type PresetPhoto = { image: string; page: string; credit: { name: string; url: string }; alt: string };
export type PresetStyle = { style: string; weights: StyleWeights; photos: Record<Convention, PresetPhoto> };
export type Round = { round: number; styles: PresetStyle[] };

export const ROUNDS = PRESETS.rounds as unknown as Round[]; // shape checked by presets.test.ts

/** Which photo set a round shows: the user's convention, alternating round by round when they wear both. */
export function conventionFor(round: number, conventions: readonly Convention[]): Convention {
  if (conventions.length === 1) return conventions[0];
  return round % 2 === 1 ? "menswear" : "womenswear";
}

/** Display URL for a preset photo (Unsplash resizes on the fly). */
export function presetSrc(photo: PresetPhoto, width = 480): string {
  return `${photo.image}?w=${width}&h=${Math.round(width * 4 / 3)}&fit=crop&crop=faces,entropy&q=70&auto=format`;
}
