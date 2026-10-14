import assert from "node:assert/strict";
import { test } from "node:test";
import type { Piece } from "@/lib/outfits/filter";
import { countOutfits, findGaps } from "./gaps";
import { keepUntil, letGoList, type LetGoPiece } from "./let-go";

let n = 0;
const piece = (category: string, formality = 2, warmth = 2, subcategory = "other"): Piece =>
  ({ id: `p${++n}`, name: `${category} ${n}`, category, subcategory, colors: ["black"], pattern: "solid", material: "cotton", formality, warmth });

test("gaps name what's missing per activity and the weathers it blocks", () => {
  const closet = [piece("top"), piece("bottom"), piece("shoes"), piece("outerwear", 2, 3)];
  const gaps = findGaps(closet, ["casual"]);
  assert.deepEqual(gaps.filter((g) => g.kind === "missing").map((g) => g.kind === "missing" && g.weathers), [["cold"]]);
  assert.deepEqual(gaps.find((g) => g.kind === "few"), { kind: "few", activity: "casual", outfits: 1 });
  assert.equal(countOutfits(closet), 1);
});

test("an activity with nothing to wear is missing in every weather", () => {
  const gaps = findGaps([piece("top", 2)], ["office"]); // too casual for the office
  const all = gaps.filter((g) => g.kind === "missing" && g.weathers.length === 6).map((g) => g.kind === "missing" && g.need);
  assert.deepEqual(all, ["a top and bottom (or a dress)", "shoes"]);
});

const lp = (over: Partial<LetGoPiece>): LetGoPiece => ({
  id: `l${++n}`, name: "x", category: "top", subcategory: "t-shirt", colors: ["grey"], status: "active", retireReason: null,
  createdAt: new Date("2024-01-01T00:00:00Z"), keptUntil: null, lastWorn: null, ...over,
});

test("sell or donate: disliked, not worn in 12 months, and extra duplicates, each once", () => {
  const today = "2026-10-14";
  const disliked = lp({ status: "retired", retireReason: "dislike" });
  const stale = lp({ lastWorn: "2025-05-01", colors: ["navy"] });
  const fresh = lp({ lastWorn: "2026-09-01", colors: ["navy"] });
  const newPiece = lp({ createdAt: new Date("2026-08-01T00:00:00Z"), colors: ["red"] });
  const kept = lp({ keptUntil: "2027-01-01", colors: ["green"] });
  const greys = [lp({ lastWorn: "2026-10-01" }), lp({ lastWorn: "2026-09-20" }), lp({ lastWorn: "2026-01-01" }), lp({ lastWorn: "2026-10-10" })];
  const items = letGoList([disliked, stale, fresh, newPiece, kept, ...greys], today);
  const keptGrey = lp({ keptUntil: "2027-01-01", lastWorn: "2025-12-01" }); // a kept grey still counts toward the group
  assert.deepEqual(letGoList([...greys, keptGrey], today).filter((i) => i.reason === "duplicate").map((i) => i.piece.id), [greys[2].id, greys[1].id]);
  const byReason = (r: string) => items.filter((i) => i.reason === r).map((i) => i.piece.id);
  assert.deepEqual(byReason("disliked"), [disliked.id]);
  assert.deepEqual(byReason("not_worn"), [stale.id]);
  assert.deepEqual(byReason("duplicate"), [greys[2].id, greys[1].id]); // keep the two most worn
  assert.equal(keepUntil(today), "2027-10-14");
});

test("buy suggestions: invalid or useless ones are dropped, new activities rank first, links are encoded", async () => {
  const { rankItems } = await import("./buy");
  const { shoppingUrl } = await import("./shopping");
  const closet = [piece("top"), piece("bottom")];
  const base = { subcategory: "sneakers", colors: ["white"], pattern: "solid", material: "leather", formality: 2, warmth: 2, reason: "Completes casual outfits." };
  const items = rankItems([
    { ...base, name: "white leather sneakers", category: "shoes" },
    { ...base, name: "White leather sneakers", category: "shoes" }, // duplicate
    { ...base, name: "mystery", category: "shoes", colors: ["plaid"] }, // not in the vocabulary
    { ...base, name: "silk scarf", category: "accessory", subcategory: "scarf" }, // completes nothing and fills no gap
  ], closet, ["casual"]);
  assert.deepEqual(items.map((i) => [i.name, i.outfits, i.newActivities, i.fillsFor]), [["white leather sneakers", 1, ["casual"], ["casual"]]]);
  // a bag goes with existing outfits but adds none and fills no gap
  const bag = rankItems([{ ...base, name: "black tote", category: "bag", subcategory: "tote" }], [piece("top"), piece("bottom"), piece("shoes")], ["casual"]);
  assert.deepEqual(bag, []);
  // only tops: a bottom completes nothing yet (no shoes), but it closes a gap, so it stays
  const tops = rankItems([{ ...base, name: "dark jeans", category: "bottom", subcategory: "jeans", material: "denim" }], [piece("top")], ["casual"]);
  assert.deepEqual(tops.map((i) => [i.outfits, i.fillsFor]), [[0, ["casual"]]]);
  assert.equal(shoppingUrl("navy wool coat & scarf"), "https://www.google.com/search?tbm=shop&q=navy%20wool%20coat%20%26%20scarf");
});
