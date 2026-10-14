// Fitting room: what an item you're considering would add to the closet. Pure code, no API calls.
import { unlocks, type Piece, type Unlock } from "./filter";

export const CANDIDATE_ID = "fitting-room-candidate"; // never a garment id (those are UUIDs)

export type Verdict = "gap" | "variety" | "duplicate";
export type Assessment = {
  unlocks: Unlock[];
  sameKind: number; // same type in the same main color: "this would be your 5th grey sweater"
  similar: number; // same type, other colors
  verdict: Verdict;
};

export function assess(closet: Piece[], candidate: Piece, activities: string[]): Assessment {
  const kind = closet.filter((p) => p.subcategory === candidate.subcategory && p.category === candidate.category);
  const sameKind = kind.filter((p) => p.colors[0] === candidate.colors[0]).length;
  const found = unlocks(closet, candidate, activities);
  const verdict: Verdict = sameKind ? "duplicate" : found.some((u) => u.isNew) ? "gap" : "variety";
  return { unlocks: found, sameKind, similar: kind.length - sameKind, verdict };
}
