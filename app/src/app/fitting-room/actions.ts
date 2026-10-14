"use server";

import {
  activeCloset, FAILED, isActivity, isWeather, SESSION_EXPIRED, signedIn, toOutfitPiece, type ClosetPiece, type Outfit,
} from "@/app/_today/closet";
import { currentUser } from "@/db/user";
import { validateTags, type GarmentTags } from "@/lib/catalog/vocabulary";
import { isAvailableOn, isLocalDate } from "@/lib/outfits/feedback";
import { candidatesFor, missingPieces, outfitsWith, type Weather } from "@/lib/outfits/filter";
import { CANDIDATE_ID } from "@/lib/outfits/fitting";
import { NO_HISTORY, suggestOutfits } from "@/lib/outfits/style";
import { summarize } from "@/lib/style/profile";
import { hourlyLimiter } from "@/lib/upload";

const overLimit = hourlyLimiter(60);
// validateTags skips missing fields (it also checks partial bulk edits): these must all be present here
const REQUIRED = ["name", "category", "subcategory", "colors", "pattern", "material", "formality", "warmth"] as const;

export type ExampleResult = { ok: true; outfits: Outfit[] } | { ok: false; error: string };

/** Example outfits with the item being considered (it isn't in the catalog: its image stays on the phone). */
export async function exampleOutfits(tags: GarmentTags, activity: string, weather: Weather, today: string): Promise<ExampleResult> {
  if (!(await signedIn())) return { ok: false, error: SESSION_EXPIRED };
  if (typeof tags !== "object" || tags === null || REQUIRED.some((k) => tags[k] === undefined) || validateTags(tags).length || !isActivity(activity) || !isWeather(weather) || !isLocalDate(today)) {
    return { ok: false, error: FAILED };
  }
  if (overLimit()) return { ok: false, error: "That's a lot of outfits in an hour. Try again later." };
  try {
    const user = await currentUser();
    const owned = (await activeCloset(user.id)).filter((g) => isAvailableOn(g, today));
    const { name, category, subcategory, colors, pattern, material, formality, warmth } = tags; // only what styling uses
    const candidate: ClosetPiece = {
      id: CANDIDATE_ID, name, category, subcategory, colors, pattern, material, formality, warmth, imageKey: "", notTodayOn: null, status: "active",
    };
    const pieces = candidatesFor([candidate, ...owned], activity, weather); // the candidate first, so a long list never cuts it
    const weatherWords = `${weather.temp}${weather.rain ? ", rainy" : ""} weather`;
    if (pieces[0] !== candidate) return { ok: false, error: `It doesn't suit ${activity.trim()} in ${weatherWords}.` };
    if (missingPieces(pieces, weather).length || !outfitsWith(pieces, candidate)) {
      return { ok: false, error: `You don't own what it needs for a complete ${activity.trim()} outfit in ${weatherWords}.` };
    }
    const profile = user.styleProfile ? summarize(user.styleProfile) : null;
    const result = await suggestOutfits(activity.trim(), weather, profile, pieces, NO_HISTORY, CANDIDATE_ID);
    if (!result.ok) return result;
    const outfits = await Promise.all(result.outfits.map(async (o) => ({
      why: o.why,
      pieces: await Promise.all(o.pieces.map((p) => p.id === CANDIDATE_ID
        ? { id: p.id, name: p.name, category: p.category, imageUrl: "" } // the phone shows its own copy
        : toOutfitPiece(p as ClosetPiece))),
    })));
    return { ok: true, outfits };
  } catch (e) {
    console.error("example outfits failed", e);
    return { ok: false, error: FAILED };
  }
}
