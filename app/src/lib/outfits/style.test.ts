import assert from "node:assert/strict";
import { test } from "node:test";
import type { Piece } from "./filter";
import { keepValid, swapPiece } from "./style";

const p = (id: string, category: string): Piece =>
  ({ id, name: id, category, subcategory: "other", colors: ["black"], pattern: "solid", material: "cotton", formality: 2, warmth: 2 });
const pieces = [p("tee", "top"), p("jeans", "bottom"), p("sneakers", "shoes"), p("shirt", "top"), p("jacket", "outerwear")];
const warm = { temp: "warm", rain: false } as const;

test("keeps complete outfits, drops invalid ones and duplicates", () => {
  const { outfits, rejected } = keepValid({
    outfits: [
      { pieces: [0, 1, 2], why: " Easy. " },
      { pieces: [2, 1, 0], why: "same pieces, other order" }, // duplicate
      { pieces: [0, 1], why: "no shoes" },
      { pieces: [0, 1, 9], why: "made-up number" },
      { pieces: [3, 1, 2, 4], why: "with a jacket" },
    ],
    needs: [],
  }, pieces, warm);
  assert.deepEqual(outfits.map((o) => o.pieces.map((x) => x.id)), [["tee", "jeans", "sneakers"], ["shirt", "jeans", "sneakers", "jacket"]]);
  assert.equal(outfits[0].why, "Easy.");
  assert.equal(rejected.length, 2);
});

test("rain makes a coat mandatory", () => {
  const { outfits } = keepValid({ outfits: [{ pieces: [0, 1, 2], why: "" }], needs: [] }, pieces, { temp: "mild", rain: true });
  assert.equal(outfits.length, 0);
});

test("an outfit worn in the last week is rejected", () => {
  const { outfits, rejected } = keepValid({ outfits: [{ pieces: [2, 0, 1], why: "" }, { pieces: [3, 1, 2], why: "" }], needs: [] },
    pieces, warm, [["tee", "jeans", "sneakers"]]);
  assert.deepEqual(outfits.map((o) => o.pieces[0].id), ["shirt"]);
  assert.deepEqual(rejected, ["repeats an outfit worn recently"]);
});

test("a swap only rejects problems the new piece brings in", async () => {
  const [tee, jeans, , shirt] = pieces;
  const r = await swapPiece([tee, jeans], tee, [shirt, p("dress", "dress")], "casual", warm, null); // shoes already dropped
  assert.ok(r.ok && r.piece.id === "shirt");
});
