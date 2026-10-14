import assert from "node:assert/strict";
import { test } from "node:test";
import { addPick, emptyProfile, summarize } from "@/lib/style/profile";
import type { Piece } from "./filter";
import { applyFeedback, isAvailableOn, isLocalDate, isRepeat, styleOf } from "./feedback";

const p = (id: string, category: string, colors: string[], pattern = "solid", formality = 3): Piece =>
  ({ id, name: id, category, subcategory: "other", colors, pattern, material: "cotton", formality, warmth: 2 });
const navyBlazer = p("blazer", "outerwear", ["navy"]);
const whiteShirt = p("shirt", "top", ["white"]);
const camelChinos = p("chinos", "bottom", ["camel"]);
const floralShirt = p("floral", "top", ["red", "yellow"], "floral", 2);

test("an outfit's colors and patterns map to the profile's palette and pattern", () => {
  const w = styleOf([navyBlazer, whiteShirt, camelChinos]);
  assert.ok(w.palette.dark > 0 && w.palette.neutral > 0 && w.palette.earth > 0);
  assert.equal(Object.values(w.palette).reduce((a, b) => a + b, 0).toFixed(6), "1.000000"); // one event counts like one pick
  assert.deepEqual(w.pattern, { solid: 1 });
  assert.equal(w.formality, 3);
  assert.ok(styleOf([floralShirt]).palette.bright === 1 && styleOf([floralShirt]).pattern.bold === 1);
  assert.equal(styleOf([p("tee", "top", ["black"]), p("jeans", "bottom", ["grey"])]).palette.monochrome > 0, true);
});

test("a like raises and a dislike lowers those weights, never below zero, without mutating", () => {
  const base = addPick(emptyProfile(), { archetypes: { minimal: 1 }, palette: { bright: 0.5, neutral: 0.5 }, fit: {}, pattern: { bold: 1 }, formality: 2 }, "round");
  const liked = applyFeedback(base, [navyBlazer, whiteShirt, camelChinos], 1);
  assert.ok(summarize(liked).palette.dark > 0);
  const disliked = applyFeedback(base, [floralShirt], -1);
  assert.equal(disliked.scores.palette.bright, 0);
  assert.equal(disliked.scores.pattern.bold, 0);
  assert.equal(base.scores.palette.bright, 0.5); // unchanged
  assert.equal(disliked.scores.archetypes.minimal, 1); // feedback never touches archetypes
});

test("not today resets the next day", () => {
  assert.equal(isAvailableOn({ notTodayOn: "2026-10-14" }, "2026-10-14"), false);
  assert.equal(isAvailableOn({ notTodayOn: "2026-10-14" }, "2026-10-15"), true);
  assert.equal(isAvailableOn({ notTodayOn: null }, "2026-10-14"), true);
  assert.ok(isLocalDate("2026-10-14") && !isLocalDate("2026-13-40") && !isLocalDate("14/10/2026"));
});

test("an outfit worn recently counts as a repeat in any order", () => {
  assert.equal(isRepeat(["a", "b", "c"], [["c", "a", "b"]]), true);
  assert.equal(isRepeat(["a", "b", "d"], [["c", "a", "b"]]), false);
});
