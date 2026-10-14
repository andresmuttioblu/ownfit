// Buy list: code finds the gaps, Haiku names concrete items to fill them, code checks and ranks them by outfits unlocked.
import { VOCAB, validateTags, type GarmentTags } from "@/lib/catalog/vocabulary";
import type { Piece } from "@/lib/outfits/filter";
import { CANDIDATE_ID } from "@/lib/outfits/fitting";
import { unlocks } from "@/lib/outfits/filter";
import { apiError, ask, styleLine } from "@/lib/outfits/style";
import type { StyleSummary } from "@/lib/style/profile";
import { findGaps, gapText, type Gap } from "./gaps";

const MAX_ITEMS = 6;
const MAX_REASON = 160;
const MAX_CLOSET_LINES = 80;
// layers and extras go with outfits that already exist, so they only earn a place by closing a gap
const BASE_CATEGORIES = new Set(["top", "bottom", "dress", "one-piece", "swimwear", "shoes"]);

type Tags = Pick<GarmentTags, "name" | "category" | "subcategory" | "colors" | "pattern" | "material" | "formality" | "warmth">;
// outfits: complete outfits it makes with what's owned; fillsFor: activities where it closes a gap even if more is still missing
export type BuyItem = Tags & { reason: string; outfits: number; newActivities: string[]; fillsFor: string[] };
export type BuyList = { generatedAt: string; gaps: string[]; items: BuyItem[] };
export type BuyResult = { ok: true; list: BuyList } | { ok: false; error: string };

const SYSTEM = `You help a person decide what to buy next for their own closet. Suggest a few item types that fill real gaps and fit their style.
Rules:
- Describe each item the way a person would search for it ("mid-weight olive overshirt", "white leather low-top sneakers"). No brands, prices or stores.
- Prefer versatile pieces that work with what they already own and fix the listed gaps first.
- Use only these values (JSON): ${JSON.stringify({ categories: VOCAB.categories, colors: VOCAB.colors, patterns: VOCAB.patterns, materials: VOCAB.materials, formality: VOCAB.formality, warmth: VOCAB.warmth })}
- name is at most ${VOCAB.limits.name} characters; reason is one short sentence that names the gap or activity it helps.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "category", "subcategory", "colors", "pattern", "material", "formality", "warmth", "reason"],
        properties: {
          name: { type: "string" },
          category: { type: "string", enum: Object.keys(VOCAB.categories) },
          subcategory: { type: "string", enum: [...new Set(Object.values(VOCAB.categories).flat())] },
          colors: { type: "array", items: { type: "string", enum: VOCAB.colors } },
          pattern: { type: "string", enum: VOCAB.patterns },
          material: { type: "string", enum: VOCAB.materials },
          formality: { type: "integer", enum: [1, 2, 3, 4, 5] },
          warmth: { type: "integer", enum: [1, 2, 3, 4, 5] },
          reason: { type: "string" },
        },
      },
    },
  },
};

const missingCount = (gaps: Gap[]) => {
  const per = new Map<string, number>();
  for (const g of gaps) if (g.kind === "missing") per.set(g.activity, (per.get(g.activity) ?? 0) + g.weathers.length);
  return per;
};

/** Suggestions the code can trust: valid tags, and each one completes an outfit or closes a gap. Ranked by what it opens up. */
export function rankItems(raw: (Tags & { reason: string })[], closet: Piece[], activities: string[]): BuyItem[] {
  const seen = new Set<string>();
  const before = missingCount(findGaps(closet, activities));
  return raw.flatMap(({ reason, ...tags }) => {
    const name = tags.name.trim();
    if (!name || seen.has(name.toLowerCase()) || validateTags({ ...tags, name }).length) return [];
    seen.add(name.toLowerCase());
    const found = unlocks(closet, { ...tags, name, id: CANDIDATE_ID }, activities);
    const outfits = BASE_CATEGORIES.has(tags.category) ? found.reduce((sum, u) => sum + u.outfits, 0) : 0;
    const after = missingCount(findGaps([...closet, { ...tags, name, id: CANDIDATE_ID }], activities));
    const fillsFor = [...before].filter(([a, n]) => (after.get(a) ?? 0) < n).map(([a]) => a);
    if (!outfits && !fillsFor.length) return [];
    return [{ ...tags, name, reason: reason.trim().slice(0, MAX_REASON), outfits, newActivities: found.filter((u) => u.isNew).map((u) => u.activity), fillsFor }];
  }).sort((a, b) => b.newActivities.length - a.newActivities.length || b.fillsFor.length - a.fillsFor.length || b.outfits - a.outfits)
    .slice(0, MAX_ITEMS);
}

export async function suggestBuys(closet: Piece[], activities: string[], profile: StyleSummary | null): Promise<BuyResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Suggestions aren't configured (ANTHROPIC_API_KEY is missing)." };
  const gaps = findGaps(closet, activities).map(gapText);
  const owned = closet.slice(0, MAX_CLOSET_LINES).map((p) => `- ${p.name} (${p.category}/${p.subcategory}, ${p.colors.join("+")}, formality ${p.formality}, warmth ${p.warmth})`);
  const user = [
    `Activities: ${activities.join(", ")}`,
    styleLine(profile),
    gaps.length ? "Gaps the closet can't cover:" : "No hard gaps: suggest pieces that add the most variety.",
    ...gaps.map((g) => `- ${g}`),
    closet.length ? "What they own:" : "They don't own anything yet: start with a versatile base.",
    ...owned,
    `Suggest up to ${MAX_ITEMS} items.`,
  ].join("\n");
  try {
    const answer = await ask<{ items: (Tags & { reason: string })[] }>(SYSTEM, user, SCHEMA);
    const items = rankItems(answer.items, closet, activities);
    if (!items.length) return { ok: false, error: "Couldn't find anything worth buying right now. Try again later." };
    return { ok: true, list: { generatedAt: new Date().toISOString(), gaps, items } };
  } catch (e) {
    const known = apiError(e);
    if (known) return { ok: false, error: known };
    console.error("buy list failed", e);
    return { ok: false, error: "Couldn't put the buy list together. Try again." };
  }
}
