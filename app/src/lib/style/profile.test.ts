import assert from "node:assert/strict";
import { test } from "node:test";
import { addPick, emptyProfile, summarize, validateWeights } from "./profile";

const minimal = { archetypes: { minimal: 1, classic: 0.5 }, palette: { neutral: 1 }, fit: { tailored: 1 }, pattern: { solid: 1 }, formality: 3 };
const street = { archetypes: { streetwear: 1 }, palette: { dark: 1, bright: 0.5 }, fit: { oversized: 1 }, pattern: { bold: 1 }, formality: 1 };

test("picks accumulate and normalize to 1 per dimension", () => {
  const p = addPick(addPick(addPick(emptyProfile(), minimal, "round"), minimal, "round"), street, "round");
  const s = summarize(p);
  assert.equal(Object.values(s.archetypes).reduce((a, b) => a + b, 0).toFixed(6), "1.000000");
  assert.deepEqual(Object.keys(s.archetypes), ["minimal", "classic", "streetwear"]); // sorted, strongest first
  assert.equal(s.archetypes.minimal, 0.5); // 2 / (2 + 1 classic + 1 streetwear)
  assert.equal(s.formalityLean, 2.3); // (3 + 3 + 1) / 3
  assert.deepEqual(s.sources, { rounds: 3, references: 0 });
});

test("adding a pick never mutates the previous profile", () => {
  const before = emptyProfile();
  const after = addPick(before, minimal, "reference");
  assert.deepEqual(before, emptyProfile());
  assert.equal(after.sources.references, 1);
});

test("an empty profile summarizes to empty weights and no formality lean", () => {
  const s = summarize(emptyProfile());
  assert.deepEqual(s.archetypes, {});
  assert.equal(s.formalityLean, null);
});

test("weights outside the vocabulary or range are rejected", () => {
  assert.deepEqual(validateWeights(minimal), []);
  assert.ok(validateWeights({ ...minimal, archetypes: { goth: 1 } }).length);
  assert.ok(validateWeights({ ...minimal, palette: { neutral: 2 } }).length);
  assert.ok(validateWeights({ ...minimal, palette: { neutral: NaN } }).length);
  assert.ok(validateWeights({ ...minimal, formality: 7 }).length);
  assert.ok(validateWeights({ ...minimal, fit: "tailored" } as never).length);
});
