// Ask Claude to put outfits together from pieces the code already filtered, then keep only valid ones.
import Anthropic from "@anthropic-ai/sdk";
import type { StyleSummary } from "@/lib/style/profile";
import { isRepeat } from "./feedback";
import { outfitProblems, type Piece, type Weather } from "./filter";
import RULES from "./rules.json";

const MODEL = "claude-haiku-5-5";
const MAX_TOKENS = 1500;
const MAX_ATTEMPTS = 2; // one retry when no suggested outfit survives validation
const MAX_OUTFITS = 3;
const MAX_NEEDS = 3;
const MAX_PIECES = 80; // keeps the prompt (and its cost) bounded as the closet grows

const SYSTEM = `You are a personal stylist putting together today's outfits from the person's own closet.
You get today's activity, the weather, the person's style profile (weights, strongest first) and a numbered list of pieces that already suit the activity and weather. Use only those numbers.
Each outfit needs a top and a bottom, or a dress / one-piece; exactly one pair of shoes; a coat or jacket when the weather says one is needed (cold, cool or rain). At most one bottom; up to two outer layers (e.g. a blazer under a coat), and in cool or cold weather at least one of them warm; extra tops only as layers; accessories optional.
Suggest ${MAX_OUTFITS} distinct outfits when the pieces allow (fewer is fine), leaning toward the person's style. Each "why" is one short sentence in plain words.
"needs" lists up to ${MAX_NEEDS} practical things for today that aren't clothes from the list (an umbrella, sunglasses, a spare layer for the evening); empty if nothing.
Styling rules:
${RULES.rules.map((r) => `- ${r.rule}`).join("\n")}`;

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["outfits", "needs"],
  properties: {
    outfits: { type: "array", items: { type: "object", additionalProperties: false, required: ["pieces", "why"],
      properties: { pieces: { type: "array", items: { type: "integer" } }, why: { type: "string" } } } },
    needs: { type: "array", items: { type: "string" } },
  },
};

export type Suggestion = { pieces: Piece[]; why: string };
/** Recent history the styling takes into account (newest first). */
// wornIds are the full worn sets (repeat check); worn/liked/disliked hold the pieces still in the closet (names for the prompt).
export type History = { wornIds: string[][]; worn: Piece[][]; liked: Piece[][]; disliked: Piece[][] };
export const NO_HISTORY: History = { wornIds: [], worn: [], liked: [], disliked: [] };
export type StyleResult = { ok: true; outfits: Suggestion[]; needs: string[] } | { ok: false; error: string };

const names = (outfits: Piece[][]) => outfits.map((o) => `- ${o.map((p) => p.name).join(" + ")}`);

function historyLines(h: History): string[] {
  return [
    ...(h.worn.length ? ["Worn recently (don't suggest the exact same outfit again):", ...names(h.worn)] : []),
    ...(h.liked.length ? ["Outfits they liked:", ...names(h.liked)] : []),
    ...(h.disliked.length ? ["Outfits they disliked (avoid what these have in common):", ...names(h.disliked)] : []),
  ];
}

/** The style profile in one prompt line. */
export function styleLine(profile: StyleSummary | null): string {
  const top = (d: Record<string, number> | undefined) => Object.keys(d ?? {}).slice(0, 4).join(", ") || "unknown";
  return profile
    ? `Style: leans ${top(profile.archetypes)}; colors ${top(profile.palette)}; fit ${top(profile.fit)}; patterns ${top(profile.pattern)}; formality lean ${profile.formalityLean ?? "unknown"}`
    : "Style: no profile yet; keep it classic and versatile.";
}

function prompt(activity: string, weather: Weather, profile: StyleSummary | null, pieces: Piece[], history: History): string {
  const lines = pieces.slice(0, MAX_PIECES).map((p, i) =>
    `${i}. ${p.name} | ${p.category}/${p.subcategory} | ${p.colors.join("+")} | ${p.pattern} | ${p.material} | formality ${p.formality} | warmth ${p.warmth}`);
  return [
    `Activity: ${activity}`,
    `Weather: ${weather.temp}${weather.rain ? ", rain" : ""}`,
    styleLine(profile),
    ...historyLines(history),
    "Pieces:", ...lines,
  ].join("\n");
}

type Answer = { outfits: { pieces: number[]; why: string }[]; needs: string[] };

/** Valid, distinct outfits from the model's answer; invalid ones are dropped with a reason. */
export function keepValid(
  answer: Answer, pieces: Piece[], weather: Weather, worn: string[][] = [], mustInclude?: string,
): { outfits: Suggestion[]; rejected: string[] } {
  const outfits: Suggestion[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  for (const o of answer.outfits) {
    const chosen = o.pieces.map((i) => pieces[i]);
    if (chosen.some((p) => !p)) { rejected.push("used a number that isn't in the list"); continue; }
    const problems = outfitProblems(chosen, weather);
    if (problems.length) { rejected.push(problems.join(", ")); continue; }
    if (isRepeat(chosen.map((p) => p.id), worn)) { rejected.push("repeats an outfit worn recently"); continue; }
    if (mustInclude && !chosen.some((p) => p.id === mustInclude)) { rejected.push("leaves out the piece it has to include"); continue; }
    const key = chosen.map((p) => p.id).sort().join();
    if (seen.has(key)) continue;
    seen.add(key);
    outfits.push({ pieces: chosen, why: o.why.trim().slice(0, 200) });
  }
  return { outfits: outfits.slice(0, MAX_OUTFITS), rejected };
}

let client: Anthropic | null = null;

class Refused extends Error {}

/** One structured-output call; throws Refused when the model declines. */
export async function ask<T>(system: string, user: string, schema: Record<string, unknown>): Promise<T> {
  client ??= new Anthropic({ timeout: 15_000, maxRetries: 1 }); // fail fast: someone is waiting on the screen
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "disabled" }, // speed: the code already did the hard filtering (target < 3 s)
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") throw new Refused();
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error(`no text block (stop_reason ${response.stop_reason})`);
  return JSON.parse(text.text) as T;
}

export function apiError(e: unknown): string | null {
  if (e instanceof Refused) return "No suggestions this time. Try another activity.";
  if (e instanceof Anthropic.AuthenticationError) return "The Anthropic API key is invalid.";
  if (e instanceof Anthropic.RateLimitError) return "Busy right now. Try again in a minute.";
  return null;
}

const NOT_CONFIGURED = "Outfit suggestions aren't configured (ANTHROPIC_API_KEY is missing).";

export async function suggestOutfits(
  activity: string, weather: Weather, profile: StyleSummary | null, pieces: Piece[], history: History = NO_HISTORY, mustInclude?: string,
): Promise<StyleResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: NOT_CONFIGURED };
  const must = pieces.findIndex((p) => p.id === mustInclude);
  const mustLine = must >= 0 ? `\nEvery outfit must include piece ${must} (${pieces[must].name}).` : "";
  let feedback = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const answer = await ask<Answer>(SYSTEM, prompt(activity, weather, profile, pieces, history) + mustLine + feedback, SCHEMA);
      const { outfits, rejected } = keepValid(answer, pieces, weather, history.wornIds, mustInclude);
      const needs = answer.needs.map((s) => s.trim().slice(0, 80)).filter(Boolean).slice(0, MAX_NEEDS);
      if (outfits.length) return { ok: true, outfits, needs };
      feedback = `\n\nYour previous outfits were all invalid (${rejected.join("; ")}). Follow the outfit rules exactly.`;
    } catch (e) {
      const known = apiError(e);
      if (known) return { ok: false, error: known };
      console.error("outfit styling failed", e);
      if (e instanceof Anthropic.BadRequestError || attempt === MAX_ATTEMPTS) return { ok: false, error: "Couldn't put outfits together. Try again." };
    }
  }
  return { ok: false, error: "Couldn't put a complete outfit together from these pieces. Try another activity." };
}

const SWAP_SYSTEM = `You are a personal stylist. Replace one piece of an outfit with the best alternative from a numbered list, so the outfit still works together and suits the activity, the weather and the person's taste.
Styling rules:
${RULES.rules.map((r) => `- ${r.rule}`).join("\n")}`;
const SWAP_SCHEMA = { type: "object", additionalProperties: false, required: ["choice"], properties: { choice: { type: "integer" } } };

export type SwapResult = { ok: true; piece: Piece } | { ok: false; error: string };

/** Swap one piece of an outfit for another piece of the same category that keeps the outfit valid. */
export async function swapPiece(
  outfit: Piece[], out: Piece, pool: Piece[], activity: string, weather: Weather, profile: StyleSummary | null,
): Promise<SwapResult> {
  const keep = outfit.filter((p) => p.id !== out.id);
  const before = new Set(outfitProblems(outfit, weather)); // only reject problems the new piece brings in
  const options = pool.filter((p) => p.category === out.category && !outfit.some((o) => o.id === p.id)
    && outfitProblems([...keep, p], weather).every((x) => before.has(x))).slice(0, MAX_PIECES);
  if (!options.length) return { ok: false, error: `No other ${out.category} fits today.` };
  if (options.length === 1) return { ok: true, piece: options[0] };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: NOT_CONFIGURED };
  try {
    const { choice } = await ask<{ choice: number }>(SWAP_SYSTEM, [
      prompt(activity, weather, profile, [], NO_HISTORY).replace(/\nPieces:$/, ""),
      `Keeping: ${keep.map((p) => p.name).join(" + ")}`,
      `Replacing: ${out.name}`,
      "Options:", ...options.map((p, i) => `${i}. ${p.name} | ${p.subcategory} | ${p.colors.join("+")} | ${p.pattern} | ${p.material} | formality ${p.formality}`),
    ].join("\n"), SWAP_SCHEMA);
    return { ok: true, piece: options[choice] ?? options[0] }; // an out-of-range answer still gets a valid option
  } catch (e) {
    const known = apiError(e);
    if (known) return { ok: false, error: known };
    console.error("swap failed", e);
    return { ok: false, error: "Couldn't swap that piece. Try again." };
  }
}
