// TypeScript side of the shared vocabulary (garment-tags.json). The pipeline's tags.py applies the same rules.
import vocab from "./garment-tags.json";

export const VOCAB = vocab;
export type Category = keyof typeof vocab.categories;
export const CATEGORIES = Object.keys(vocab.categories) as Category[];

export type GarmentTags = {
  name: string;
  category: string;
  subcategory: string;
  colors: string[];
  pattern: string;
  material: string;
  formality: number;
  warmth: number;
  seasons: string[];
  tags: string[];
};

const isScale = (v: unknown) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;

/** Problems with a full or partial tag set (partial = bulk edit); empty means valid. */
export function validateTags(t: Partial<GarmentTags>): string[] {
  // Shape first: values may come from a client or a model, not just from our own code.
  const shapeErrors = [
    ...(["name", "category", "subcategory", "pattern", "material"] as const).filter((k) => t[k] !== undefined && typeof t[k] !== "string"),
    ...(["colors", "seasons", "tags"] as const).filter((k) => t[k] !== undefined && !Array.isArray(t[k])),
  ].map((k) => `${k} has the wrong type`);
  if (shapeErrors.length) return shapeErrors;
  const errors: string[] = [];
  const { categories, colors, patterns, materials, seasons, limits } = vocab;
  if (t.category !== undefined && !Object.hasOwn(categories, t.category)) errors.push(`Unknown category: ${t.category}`);
  if (t.subcategory !== undefined) {
    const cat = t.category as Category | undefined;
    if (!cat || !(categories[cat] as string[])?.includes(t.subcategory)) errors.push(`Subcategory ${t.subcategory} doesn't fit ${cat ?? "(no category)"}`);
  }
  if (t.colors !== undefined && !(t.colors.length >= 1 && t.colors.length <= limits.colors && t.colors.every((c) => colors.includes(c))))
    errors.push(`Colors must be 1-${limits.colors} known colors`);
  if (t.pattern !== undefined && !patterns.includes(t.pattern)) errors.push(`Unknown pattern: ${t.pattern}`);
  if (t.material !== undefined && !materials.includes(t.material)) errors.push(`Unknown material: ${t.material}`);
  if (t.formality !== undefined && !isScale(t.formality)) errors.push("Formality must be 1-5");
  if (t.warmth !== undefined && !isScale(t.warmth)) errors.push("Warmth must be 1-5");
  if (t.seasons !== undefined && !(t.seasons.length >= 1 && t.seasons.every((s) => seasons.includes(s)))) errors.push("Pick at least one season");
  if (t.tags !== undefined && !(t.tags.length <= limits.tags && t.tags.every((s) => typeof s === "string" && s.length <= limits.tag_length)))
    errors.push(`Up to ${limits.tags} short tags`);
  if (t.name !== undefined && !(t.name.trim().length > 0 && t.name.length <= limits.name)) errors.push(`Name must be 1-${limits.name} characters`);
  return errors;
}
