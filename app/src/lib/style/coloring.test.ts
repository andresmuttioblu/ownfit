import { test } from "node:test";
import assert from "node:assert/strict";
import { styleLine } from "@/lib/outfits/style";
import { cleanColoring, coloringLine, coloringProblem, knownColors, type Coloring } from "./coloring";
import { styleFor } from "./profile";

const ok: Coloring = { undertone: "warm", season: "autumn", suits: ["olive", "camel"], avoid: ["pink"] };

test("a full or skipped coloring is valid", () => {
  assert.equal(coloringProblem(ok), null);
  assert.equal(coloringProblem(null), null);
  assert.equal(coloringProblem({ undertone: "not sure", season: null, suits: [], avoid: [] }), null);
});

test("rejects unknown values, too many colors and a color in both lists", () => {
  assert.ok(coloringProblem({ ...ok, undertone: "olive" as Coloring["undertone"] }));
  assert.ok(coloringProblem({ ...ok, season: "deep winter" as Coloring["season"] }));
  assert.ok(coloringProblem({ ...ok, suits: ["neon"] }));
  assert.ok(coloringProblem({ ...ok, suits: ["olive", "olive"] }));
  assert.ok(coloringProblem({ ...ok, suits: ["black", "white", "cream", "beige", "camel", "brown", "grey"] }));
  assert.ok(coloringProblem({ ...ok, avoid: ["olive"] }));
  assert.ok(coloringProblem({ ...ok, avoid: "pink" as unknown as string[] }));
});

test("the prompt line names only what was answered", () => {
  assert.equal(coloringLine(null), null);
  assert.equal(coloringLine({ undertone: "not sure", season: null, suits: [], avoid: [] }), null);
  const line = coloringLine({ undertone: "not sure", season: null, suits: ["navy"], avoid: [] })!;
  assert.match(line, /colors that suit them: navy/);
  assert.doesNotMatch(line, /undertone|season|avoid near/);
});

test("the style line carries the coloring, even without a style profile", () => {
  assert.equal(styleFor({ styleProfile: null, coloring: null }), null);
  const line = styleLine(styleFor({ styleProfile: null, coloring: ok }));
  assert.match(line, /warm undertone; autumn color season; colors that suit them: olive, camel; colors to avoid near the face: pink/);
  assert.match(line, /no profile yet/);
  assert.doesNotMatch(styleLine(null), /Coloring/);
});

test("only the known fields are stored, and an empty answer is stored as null", () => {
  assert.deepEqual(cleanColoring({ ...ok, extra: "x" } as Coloring), ok);
  assert.equal(cleanColoring({ undertone: "not sure", season: null, suits: [], avoid: [] }), null);
  assert.ok(coloringProblem({ ...ok, suits: [, "red"] as string[] })); // holes
  assert.deepEqual(knownColors({ ...ok, suits: ["olive", "retired-color"] })?.suits, ["olive"]);
});
