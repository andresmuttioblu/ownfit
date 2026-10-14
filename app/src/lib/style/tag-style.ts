// Read the style of one inspiration image with Claude, in the same terms as the onboarding presets.
import Anthropic from "@anthropic-ai/sdk";
import { DIMENSIONS, STYLE_VOCAB, validateWeights, type StyleWeights } from "./profile";

const MODEL = "claude-haiku-5-5";
const MAX_TOKENS = 1000;

const SYSTEM = `You read the clothing style of an inspiration photo for a personal style profile. Describe the outfit, never the person.
For each list, give the values that apply with a strength from 0 to 1 (1 = defining, 0.3 = a hint); leave out values that don't apply.
archetypes: ${STYLE_VOCAB.archetypes.join(", ")}
palette: ${STYLE_VOCAB.palette.join(", ")}
fit: ${STYLE_VOCAB.fit.join(", ")}
pattern: ${STYLE_VOCAB.pattern.join(", ")}
formality: 1 (very casual) to 5 (black tie).
If the image shows no outfit at all, set no_outfit to true and give your best guess for the rest.`;

const strengths = (values: string[]) => ({
  type: "array",
  items: { type: "object", additionalProperties: false, required: ["value", "strength"],
    properties: { value: { type: "string", enum: values }, strength: { type: "number" } } },
});

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["no_outfit", ...DIMENSIONS, "formality"],
  properties: {
    no_outfit: { type: "boolean" },
    ...Object.fromEntries(DIMENSIONS.map((d) => [d, strengths(STYLE_VOCAB[d])])),
    formality: { type: "integer", enum: [1, 2, 3, 4, 5] },
  },
};

type Answer = { no_outfit: boolean; formality: number } & Record<(typeof DIMENSIONS)[number], { value: string; strength: number }[]>;

export type StyleTagResult = { ok: true; weights: StyleWeights; noOutfit: boolean } | { ok: false; error: string };

let client: Anthropic | null = null;

export async function tagStyleImage(jpegBase64: string): Promise<StyleTagResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Reading images isn't configured (ANTHROPIC_API_KEY is missing)." };
  client ??= new Anthropic();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpegBase64 } },
        { type: "text", text: "Read this outfit's style." },
      ] }],
    });
    if (response.stop_reason === "refusal") return { ok: false, error: "That image couldn't be read. Try another one." };
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error(`no text block (stop_reason ${response.stop_reason})`);
    const answer = JSON.parse(text.text) as Answer;
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const weights = {
      ...Object.fromEntries(DIMENSIONS.map((d) => [d, Object.fromEntries(answer[d].map((x) => [x.value, clamp(x.strength)]))])),
      formality: answer.formality,
    } as StyleWeights;
    const errors = validateWeights(weights);
    if (errors.length) throw new Error(`invalid style answer: ${errors.join("; ")}`);
    return { ok: true, weights, noOutfit: answer.no_outfit };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: "The Anthropic API key is invalid." };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, error: "Busy right now. Try again in a minute." };
    console.error("style tagging failed", e);
    return { ok: false, error: "That image couldn't be read. Try another one." };
  }
}
