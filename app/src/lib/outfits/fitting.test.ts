import assert from "node:assert/strict";
import { test } from "node:test";
import { assess, CANDIDATE_ID } from "./fitting";
import type { Piece } from "./filter";

let n = 0;
const p = (category: string, subcategory: string, color: string, formality = 2): Piece =>
  ({ id: `g${++n}`, name: `${color} ${subcategory}`, category, subcategory, colors: [color], pattern: "solid", material: "cotton", formality, warmth: 3 });
const candidate = (category: string, subcategory: string, color: string, formality = 2) => ({ ...p(category, subcategory, color, formality), id: CANDIDATE_ID });

const closet = [p("top", "sweater", "grey"), p("top", "sweater", "grey"), p("top", "sweater", "navy"), p("bottom", "jeans", "blue")];

test("another grey sweater is a duplicate, counting the ones you own", () => {
  const a = assess(closet, candidate("top", "sweater", "grey"), ["casual"]);
  assert.equal(a.verdict, "duplicate");
  assert.equal(a.sameKind, 2);
  assert.equal(a.similar, 1);
});

test("the first pair of shoes fills a gap; a different top only adds variety", () => {
  const shoes = assess(closet, candidate("shoes", "sneakers", "white"), ["casual"]);
  assert.equal(shoes.verdict, "gap");
  assert.deepEqual(shoes.unlocks, [{ activity: "casual", outfits: 3, isNew: true }]);
  const withShoes = [...closet, p("shoes", "sneakers", "white")];
  const shirt = assess(withShoes, candidate("top", "shirt", "white"), ["casual"]);
  assert.equal(shirt.verdict, "variety");
  assert.deepEqual(shirt.unlocks, [{ activity: "casual", outfits: 1, isNew: false }]);
});
