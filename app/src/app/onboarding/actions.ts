"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { currentUser } from "@/db/user";
import { requireAuth } from "@/lib/auth";
import { ROUNDS, type Convention } from "@/lib/style/presets";
import { addPick, emptyProfile, STYLE_VOCAB, summarize, validateWeights, type StyleSummary, type StyleWeights } from "@/lib/style/profile";

export type OnboardingInput = {
  name: string;
  age: number | null;
  conventions: Convention[];
  picks: (string | null)[]; // per round: the picked style, or null for "none of these"
  references: StyleWeights[]; // read by /api/style/reference
  activities: string[];
};

export type OnboardingResult = { ok: true; profile: StyleSummary } | { ok: false; error: string };

const { limits } = STYLE_VOCAB;
const MAX_NAME = 60;

function problems(input: OnboardingInput): string | null {
  if (typeof input !== "object" || input === null) return "Invalid input";
  const { name, age, conventions, picks, references, activities } = input;
  if (typeof name !== "string" || name.trim().length > MAX_NAME) return `Name must be at most ${MAX_NAME} characters`;
  if (age !== null && (!Number.isInteger(age) || age < 1 || age > 120)) return "Age must be a whole number";
  if (!Array.isArray(conventions) || !conventions.length || conventions.some((c) => !STYLE_VOCAB.conventions.includes(c))) return "Pick menswear, womenswear or both";
  if (!Array.isArray(picks) || picks.length !== ROUNDS.length) return "Finish the style rounds";
  if (picks.some((p, i) => p !== null && !ROUNDS[i].styles.some((s) => s.style === p))) return "Unknown style pick";
  if (!Array.isArray(references) || references.length > limits.references || references.some((w) => validateWeights(w).length)) return "Invalid reference images";
  if (!Array.isArray(activities) || !activities.length || activities.length > limits.activities) return `Pick 1-${limits.activities} activities`;
  if (activities.some((a) => typeof a !== "string" || !a.trim() || a.trim().length > limits.activity_length)) return `Activities must be 1-${limits.activity_length} characters`;
  return null;
}

/**
 * Saves the answers and builds the style profile. Pick weights are looked up from the presets; reference
 * weights come from the client (read by /api/style/reference) and are only range-checked: it's the user's own profile.
 */
export async function saveOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Your session expired. Reload and sign in again." };
  }
  const problem = problems(input);
  if (problem) return { ok: false, error: problem };
  let profile = emptyProfile();
  input.picks.forEach((pick, i) => {
    const style = ROUNDS[i].styles.find((s) => s.style === pick);
    if (style) profile = addPick(profile, style.weights, "round");
  });
  for (const w of input.references) profile = addPick(profile, w, "reference");
  try {
    const user = await currentUser();
    await db.update(users).set({
      name: input.name.trim() || null,
      age: input.age,
      conventions: [...new Set(input.conventions)],
      activities: [...new Set(input.activities.map((a) => a.trim().toLowerCase()))],
      styleProfile: profile,
      onboardedAt: new Date(),
    }).where(eq(users.id, user.id));
    return { ok: true, profile: summarize(profile) };
  } catch (e) {
    console.error("save onboarding failed", e);
    return { ok: false, error: "Saving failed. Please try again." };
  }
}
