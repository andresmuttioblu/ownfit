// Ask Claude to put outfits together from pieces the code already filtered, then keep only valid ones.
import Anthropic from "@anthropic-ai/sdk";
import type { StyleSummary } from "@/lib/style/profile";
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
export type StyleResult = { ok: true; outfits: Suggestion[]; needs: string[] } | { ok: false; error: string };

function prompt(activity: string, weather: Weather, profile: StyleSummary | null, pieces: Piece[]): string {
  const top = (d: Record<string, number> | undefined) => Object.keys(d ?? {}).slice(0, 4).join(", ") || "unknown";
  const lines = pieces.slice(0, MAX_PIECES).map((p, i) =>
    `${i}. ${p.name} | ${p.category}/${p.subcategory} | ${p.colors.join("+")} | ${p.pattern} | ${p.material} | formality ${p.formality} | warmth ${p.warmth}`);
  return [
    `Activity: ${activity}`,
    `Weather: ${weather.temp}${weather.rain ? ", rain" : ""}`,
    profile
      ? `Style: leans ${top(profile.archetypes)}; colors ${top(profile.palette)}; fit ${top(profile.fit)}; patterns ${top(profile.pattern)}; formality lean ${profile.formalityLean ?? "unknown"}`
      : "Style: no profile yet; keep it classic and versatile.",
    "Pieces:", ...lines,
  ].join("\n");
}

type Answer = { outfits: { pieces: number[]; why: string }[]; needs: string[] };

/** Valid, distinct outfits from the model's answer; invalid ones are dropped with a reason. */
export function keepValid(answer: Answer, pieces: Piece[], weather: Weather): { outfits: Suggestion[]; rejected: string[] } {
  const outfits: Suggestion[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  for (const o of answer.outfits) {
    const chosen = o.pieces.map((i) => pieces[i]);
    if (chosen.some((p) => !p)) { rejected.push("used a number that isn't in the list"); continue; }
    const problems = outfitProblems(chosen, weather);
    if (problems.length) { rejected.push(problems.join(", ")); continue; }
    const key = chosen.map((p) => p.id).sort().join();
    if (seen.has(key)) continue;
    seen.add(key);
    outfits.push({ pieces: chosen, why: o.why.trim().slice(0, 200) });
  }
  return { outfits: outfits.slice(0, MAX_OUTFITS), rejected };
}

let client: Anthropic | null = null;

export async function suggestOutfits(activity: string, weather: Weather, profile: StyleSummary | null, pieces: Piece[]): Promise<StyleResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Outfit suggestions aren't configured (ANTHROPIC_API_KEY is missing)." };
  client ??= new Anthropic({ timeout: 15_000, maxRetries: 1 }); // fail fast: someone is waiting on the screen
  let feedback = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "disabled" }, // speed: the code already did the hard filtering (target < 3 s)
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: prompt(activity, weather, profile, pieces) + feedback }],
      });
      if (response.stop_reason === "refusal") return { ok: false, error: "No suggestions this time. Try another activity." };
      const text = response.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") throw new Error(`no text block (stop_reason ${response.stop_reason})`);
      const answer = JSON.parse(text.text) as Answer;
      const { outfits, rejected } = keepValid(answer, pieces, weather);
      const needs = answer.needs.map((s) => s.trim().slice(0, 80)).filter(Boolean).slice(0, MAX_NEEDS);
      if (outfits.length) return { ok: true, outfits, needs };
      feedback = `\n\nYour previous outfits were all invalid (${rejected.join("; ")}). Follow the outfit rules exactly.`;
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: "The Anthropic API key is invalid." };
      if (e instanceof Anthropic.RateLimitError) return { ok: false, error: "Busy right now. Try again in a minute." };
      console.error("outfit styling failed", e);
      if (e instanceof Anthropic.BadRequestError || attempt === MAX_ATTEMPTS) return { ok: false, error: "Couldn't put outfits together. Try again." };
    }
  }
  return { ok: false, error: "Couldn't put a complete outfit together from these pieces. Try another activity." };
}
