import assert from "node:assert/strict";
import { test } from "node:test";
import { conventionFor, ROUNDS } from "./presets";
import { validateWeights } from "./profile";

test("5 rounds of 4 styles, each with a valid menswear and womenswear photo", () => {
  assert.equal(ROUNDS.length, 5);
  for (const r of ROUNDS) {
    assert.equal(r.styles.length, 4, `round ${r.round}`);
    for (const s of r.styles) {
      assert.deepEqual(validateWeights(s.weights), [], s.style);
      for (const conv of ["menswear", "womenswear"] as const) {
        const p = s.photos[conv];
        assert.match(p.image, /^https:\/\/images\.unsplash\.com\/photo-[\w-]+$/, `${s.style} ${conv}`); // free-license host, no query
        assert.match(p.page, /^https:\/\/unsplash\.com\/photos\//);
        assert.ok(p.credit.name && p.credit.url.startsWith("https://unsplash.com/@"));
      }
    }
  }
  const images = ROUNDS.flatMap((r) => r.styles.flatMap((s) => [s.photos.menswear.image, s.photos.womenswear.image]));
  assert.equal(new Set(images).size, 40, "no photo is used twice");
});

test("a single convention always shows its own set; both alternate", () => {
  assert.deepEqual([1, 2, 3].map((r) => conventionFor(r, ["womenswear"])), ["womenswear", "womenswear", "womenswear"]);
  assert.deepEqual([1, 2, 3].map((r) => conventionFor(r, ["menswear", "womenswear"])), ["menswear", "womenswear", "menswear"]);
});
