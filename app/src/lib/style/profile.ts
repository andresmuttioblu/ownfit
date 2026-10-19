// Style profile: raw scores accumulated from onboarding picks and reference images.
// Kept raw so later feedback (Stage 6) can keep adding to it; summarize() gives the readable view.
import STYLE_VOCAB from "./style-vocab.json";
import type { Coloring } from "./coloring";

export { STYLE_VOCAB };

export const DIMENSIONS = ["archetypes", "palette", "fit", "pattern"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** What one image says about a style: 0-1 per attribute, plus a formality 1-5. */
export type StyleWeights = Record<Dimension, Record<string, number>> & { formality: number };

export type StyleProfile = {
  scores: Record<Dimension, Record<string, number>>;
  formality: { sum: number; count: number };
  sources: { rounds: number; references: number };
};

export type StyleSummary = Record<Dimension, Record<string, number>> & {
  formalityLean: number | null;
  sources: StyleProfile["sources"];
  coloring?: Coloring | null;
};

export function emptyProfile(): StyleProfile {
  return {
    scores: { archetypes: {}, palette: {}, fit: {}, pattern: {} },
    formality: { sum: 0, count: 0 },
    sources: { rounds: 0, references: 0 },
  };
}

/** Returns a new profile with one picked image's weights added. */
export function addPick(profile: StyleProfile, w: StyleWeights, source: "round" | "reference"): StyleProfile {
  const scores = Object.fromEntries(DIMENSIONS.map((d) => {
    const next = { ...profile.scores[d] };
    for (const [k, v] of Object.entries(w[d])) next[k] = (next[k] ?? 0) + v;
    return [d, next];
  })) as StyleProfile["scores"];
  return {
    scores,
    formality: { sum: profile.formality.sum + w.formality, count: profile.formality.count + 1 },
    sources: {
      rounds: profile.sources.rounds + (source === "round" ? 1 : 0),
      references: profile.sources.references + (source === "reference" ? 1 : 0),
    },
  };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Each dimension normalized to sum to 1, strongest first. */
export function summarize(profile: StyleProfile): StyleSummary {
  const dims = Object.fromEntries(DIMENSIONS.map((d) => {
    const entries = Object.entries(profile.scores[d]).filter(([, v]) => v > 0);
    const total = entries.reduce((a, [, v]) => a + v, 0);
    return [d, Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, round3(v / total)]))];
  })) as Record<Dimension, Record<string, number>>;
  const { sum, count } = profile.formality;
  return { ...dims, formalityLean: count ? Math.round((sum / count) * 10) / 10 : null, sources: profile.sources };
}

/** What the prompts get for a user: the summarized profile plus their coloring, or null when there's neither. */
export function styleFor(user: { styleProfile: StyleProfile | null; coloring: Coloring | null }): StyleSummary | null {
  if (!user.styleProfile && !user.coloring) return null;
  return { ...summarize(user.styleProfile ?? emptyProfile()), coloring: user.coloring };
}

/** Problems with a weights object (from a preset file or a model), empty if it's valid. */
export function validateWeights(w: StyleWeights): string[] {
  const errors: string[] = [];
  for (const d of DIMENSIONS) {
    const values = w?.[d];
    if (typeof values !== "object" || values === null || Array.isArray(values)) { errors.push(`${d} must be an object`); continue; }
    const allowed: readonly string[] = STYLE_VOCAB[d];
    for (const [k, v] of Object.entries(values)) {
      if (!allowed.includes(k)) errors.push(`${d}: unknown "${k}"`);
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) errors.push(`${d}.${k} must be 0-1`);
    }
  }
  if (!Number.isInteger(w?.formality) || w.formality < 1 || w.formality > 5) errors.push("formality must be 1-5");
  return errors;
}
