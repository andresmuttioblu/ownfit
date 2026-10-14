// Tag one clean garment image with Claude, constrained to the shared vocabulary.
import Anthropic from "@anthropic-ai/sdk";
import { VOCAB, validateTags, type GarmentTags } from "./vocabulary";

const MODEL = "claude-haiku-5-5"; // fixed-vocabulary tagging: Haiku is enough and far cheaper
const MAX_TOKENS = 2000;
const MAX_ATTEMPTS = 2; // one retry when the answer doesn't fit the vocabulary

// Stable across requests (cache-friendly): built once from the vocabulary file.
const SYSTEM = `You tag photos of clothing for a personal wardrobe catalog. The image shows one item on a white background, already cut out.
Tag only that item. Never describe a person. Use only values from this vocabulary (JSON):
${JSON.stringify({ categories: VOCAB.categories, colors: VOCAB.colors, patterns: VOCAB.patterns, materials: VOCAB.materials, seasons: VOCAB.seasons, formality: VOCAB.formality, warmth: VOCAB.warmth })}
Rules: colors are 1-${VOCAB.limits.colors} values, main color first. seasons lists every season the item suits. formality and warmth are integers 1-5 per the labels. name is short and specific, the way a person would say it ("navy merino crew-neck sweater"), at most ${VOCAB.limits.name} characters. tags are up to ${VOCAB.limits.tags} lowercase styling details (e.g. "crew-neck", "cropped", "gold-hardware"), each at most ${VOCAB.limits.tag_length} characters. If the image is not a clothing item, shoe, bag, accessory or jewelry, set not_garment to true and fill the other fields with your best guess.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["not_garment", "name", "category", "subcategory", "colors", "pattern", "material", "formality", "warmth", "seasons", "tags"],
  properties: {
    not_garment: { type: "boolean" },
    name: { type: "string" },
    category: { type: "string", enum: Object.keys(VOCAB.categories) },
    subcategory: { type: "string", enum: [...new Set(Object.values(VOCAB.categories).flat())] },
    colors: { type: "array", items: { type: "string", enum: VOCAB.colors } },
    pattern: { type: "string", enum: VOCAB.patterns },
    material: { type: "string", enum: VOCAB.materials },
    formality: { type: "integer", enum: [1, 2, 3, 4, 5] },
    warmth: { type: "integer", enum: [1, 2, 3, 4, 5] },
    seasons: { type: "array", items: { type: "string", enum: VOCAB.seasons } },
    tags: { type: "array", items: { type: "string" } },
  },
};

export type TagResult = { ok: true; tags: GarmentTags; notGarment: boolean } | { ok: false; error: string };

let client: Anthropic | null = null;

/** A shop photo or screenshot may show a model or several items: only the item for sale gets tagged. */
const SHOP_NOTE = " This is a shop photo or screenshot, not a cutout: it may show a person wearing it or other items. Tag only the main item being sold, and never describe the person.";

export async function tagGarmentImage(base64: string, source: "cutout" | "shop" = "cutout"): Promise<TagResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Tagging isn't configured (ANTHROPIC_API_KEY is missing)." };
  client ??= new Anthropic();
  let feedback = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: source === "shop" ? "image/jpeg" : "image/png", data: base64 } },
            { type: "text", text: `Tag this item.${source === "shop" ? SHOP_NOTE : ""}${feedback}` },
          ],
        }],
      });
      if (response.stop_reason === "refusal") return { ok: false, error: "The image couldn't be tagged. Try another photo." };
      const text = response.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") throw new Error(`no text block (stop_reason ${response.stop_reason})`);
      const { not_garment: notGarment, ...tags } = JSON.parse(text.text) as GarmentTags & { not_garment: boolean };
      const errors = validateTags(tags);
      if (errors.length === 0) return { ok: true, tags, notGarment };
      feedback = ` A previous answer had these problems, avoid them: ${errors.join("; ")}`;
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: "The Anthropic API key is invalid." };
      if (e instanceof Anthropic.RateLimitError) return { ok: false, error: "Tagging is busy right now. Try again in a minute." };
      if (e instanceof Anthropic.BadRequestError) { // retrying the same request won't help
        console.error("tagging rejected", e);
        return { ok: false, error: "Tagging failed. You can fill in the tags yourself." };
      }
      console.error("tagging failed", e);
      if (attempt === MAX_ATTEMPTS) return { ok: false, error: "Tagging failed. You can fill in the tags yourself." };
    }
  }
  return { ok: false, error: "Tagging gave an incomplete answer. You can fill in the tags yourself." };
}
