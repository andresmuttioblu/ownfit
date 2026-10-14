import assert from "node:assert/strict";
import { test } from "node:test";
import { candidatesFor, formalityRange, missingPieces, outfitProblems, type Piece } from "./filter";

let n = 0;
const piece = (category: string, formality: number, warmth: number, subcategory = "other"): Piece =>
  ({ id: `g${++n}`, name: `${category} ${n}`, category, subcategory, colors: ["black"], pattern: "solid", material: "cotton", formality, warmth });

const tee = piece("top", 2, 2, "t-shirt");
const tank = piece("top", 1, 1, "tank-top");
const sweater = piece("top", 3, 4, "sweater");
const jeans = piece("bottom", 2, 3, "jeans");
const shorts = piece("bottom", 1, 1, "shorts");
const suitTrousers = piece("bottom", 4, 3, "trousers");
const sneakers = piece("shoes", 2, 2, "sneakers");
const parka = piece("outerwear", 2, 5, "parka");
const denimJacket = piece("outerwear", 2, 3, "jacket");
const dress = piece("dress", 3, 2);
const swim = piece("swimwear", 1, 1);
const closet = [tee, tank, sweater, jeans, shorts, suitTrousers, sneakers, parka, denimJacket, dress, swim];

test("activities map to formality ranges; unknown ones allow everything", () => {
  assert.deepEqual(formalityRange("office"), [3, 4]);
  assert.deepEqual(formalityRange("gym"), [1, 1]);
  assert.deepEqual(formalityRange("date night"), [1, 5]);
});

test("hot weather drops warm pieces and shorts survive; cold drops shorts and tanks", () => {
  const hot = candidatesFor(closet, "casual", { temp: "hot", rain: false }).map((p) => p.id);
  assert.ok(hot.includes(shorts.id) && hot.includes(tee.id));
  assert.ok(!hot.includes(parka.id) && !hot.includes(sweater.id));
  const cold = candidatesFor(closet, "casual", { temp: "cold", rain: false }).map((p) => p.id);
  assert.ok(cold.includes(parka.id) && cold.includes(jeans.id) && cold.includes(tee.id)); // a tee can layer
  assert.ok(cold.includes(sneakers.id) && cold.includes(denimJacket.id)); // sneakers are fine; the jacket can layer
  assert.ok(!cold.includes(shorts.id) && !cold.includes(tank.id));
});

test("formality range filters clothing; swimwear only for custom activities", () => {
  const office = candidatesFor(closet, "office", { temp: "mild", rain: false }).map((p) => p.id);
  assert.ok(office.includes(suitTrousers.id) && office.includes(sweater.id));
  assert.ok(!office.includes(jeans.id) && !office.includes(shorts.id));
  assert.ok(!candidatesFor(closet, "casual", { temp: "hot", rain: false }).some((p) => p.id === swim.id));
  assert.ok(candidatesFor(closet, "beach day", { temp: "hot", rain: false }).some((p) => p.id === swim.id));
});

test("missing pieces name what the catalog can't cover", () => {
  assert.deepEqual(missingPieces([tee, jeans], { temp: "mild", rain: false }), ["shoes"]);
  assert.deepEqual(missingPieces([tee, sneakers], { temp: "cold", rain: false }), ["a bottom (or a dress)", "a coat or jacket warm enough for cold weather"]);
  assert.deepEqual(missingPieces([tee, jeans, sneakers, denimJacket], { temp: "cold", rain: false }), ["a coat or jacket warm enough for cold weather"]);
  assert.deepEqual(missingPieces([dress, sneakers], { temp: "warm", rain: false }), []);
});

test("an outfit must be complete and not double up", () => {
  const warm = { temp: "warm", rain: false } as const;
  assert.deepEqual(outfitProblems([tee, jeans, sneakers], warm), []);
  assert.deepEqual(outfitProblems([dress, sneakers], warm), []);
  assert.ok(outfitProblems([tee, jeans], warm).length); // no shoes
  assert.ok(outfitProblems([tee, jeans, shorts, sneakers], warm).length); // two bottoms
  assert.ok(outfitProblems([tee, jeans, sneakers], { temp: "mild", rain: true }).length); // rain needs outerwear
  assert.deepEqual(outfitProblems([tee, sweater, jeans, sneakers, parka], { temp: "cold", rain: false }), []); // layered tops are fine
  assert.deepEqual(outfitProblems([tee, jeans, sneakers, denimJacket, parka], { temp: "cold", rain: false }), []); // jacket under a coat
  assert.ok(outfitProblems([tee, jeans, sneakers, denimJacket], { temp: "cold", rain: false }).length); // jacket alone is too light
});
