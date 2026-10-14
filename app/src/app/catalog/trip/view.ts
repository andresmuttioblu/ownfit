// Server-only: a saved trip with signed image URLs for the pieces it still finds in the closet.
import { activeCloset, toOutfitPiece, type OutfitPiece } from "@/app/_today/closet";
import type { Trip } from "@/lib/trip/capsule";

export type TripView = { trip: Trip; pieces: Record<string, OutfitPiece> };

export async function tripView(userId: string, trip: Trip): Promise<TripView> {
  const wanted = new Set(trip.capsule);
  const closet = (await activeCloset(userId, true)).filter((p) => wanted.has(p.id));
  return { trip, pieces: Object.fromEntries(await Promise.all(closet.map(async (p) => [p.id, await toOutfitPiece(p)] as const))) };
}
