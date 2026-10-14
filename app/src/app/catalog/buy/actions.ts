"use server";

import { eq } from "drizzle-orm";
import { activeCloset, SESSION_EXPIRED, signedIn } from "@/app/_today/closet";
import { db } from "@/db";
import { users } from "@/db/schema";
import { currentUser } from "@/db/user";
import { suggestBuys, type BuyResult } from "@/lib/lists/buy";
import { summarize } from "@/lib/style/profile";
import STYLE_VOCAB from "@/lib/style/style-vocab.json";
import { hourlyLimiter } from "@/lib/upload";

const overLimit = hourlyLimiter(10); // a list doesn't change much; the Anthropic spend limit is the real cap

/** Builds a fresh buy list from the current closet and saves it, so opening the page doesn't call the API. */
export async function refreshBuyList(): Promise<BuyResult> {
  if (!(await signedIn())) return { ok: false, error: SESSION_EXPIRED };
  if (overLimit()) return { ok: false, error: "That's a lot of refreshes in an hour. Try again later." };
  try {
    const user = await currentUser();
    const closet = await activeCloset(user.id);
    const activities = user.activities.length ? user.activities : STYLE_VOCAB.activities;
    const result = await suggestBuys(closet, activities, user.styleProfile ? summarize(user.styleProfile) : null);
    if (result.ok) await db.update(users).set({ buyList: result.list }).where(eq(users.id, user.id));
    return result;
  } catch (e) {
    console.error("refresh buy list failed", e);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
