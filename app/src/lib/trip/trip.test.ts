import assert from "node:assert/strict";
import { test } from "node:test";
import type { Piece, Weather } from "@/lib/outfits/filter";
import { dressDay, planDays, tripPool, type TripDay } from "./capsule";
import { addDays, archiveStart, isDestination, sourceFor, toWeather } from "./weather";

let n = 0;
const piece = (category: string, formality = 2, warmth = 3): Piece =>
  ({ id: `p${++n}`, name: `${category} ${n}`, category, subcategory: "other", colors: ["black"], pattern: "solid", material: "cotton", formality, warmth });
const day = (i: number, weather: Weather, activity = "casual"): TripDay => ({ date: addDays("2026-11-02", i), weather, activity });
const MILD: Weather = { temp: "mild", rain: false };

test("daily highs and rain map to the closet's weather words", () => {
  assert.deepEqual(toWeather(31, 0), { temp: "hot", rain: false });
  assert.deepEqual(toWeather(22, 5), { temp: "warm", rain: true });
  assert.deepEqual(toWeather(14.9, 1.9), { temp: "cool", rain: false });
  assert.deepEqual(toWeather(-3, null), { temp: "cold", rain: false });
  assert.deepEqual(toWeather(null, null), MILD); // missing data reads as mild and dry
});

test("the forecast is used only when the whole trip is within 16 days", () => {
  assert.equal(sourceFor("2026-10-14", 16, "2026-10-14"), "forecast");
  assert.equal(sourceFor("2026-10-20", 11, "2026-10-14"), "last-year");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
});

test("destinations are short plain text", () => {
  assert.ok(isDestination("São Paulo"));
  assert.ok(!isDestination("   "));
  assert.ok(!isDestination("a\nb"));
  assert.ok(!isDestination("x".repeat(101)));
});

test("a day reuses packed pieces and adds a coat when it's cold", () => {
  const [t1, t2, b, s, coat] = [piece("top"), piece("top"), piece("bottom"), piece("shoes"), piece("outerwear", 2, 5)];
  assert.deepEqual(dressDay([t1, t2, b, s, coat], MILD, new Set([t2.id]))?.map((p) => p.id), [t2.id, b.id, s.id]);
  assert.deepEqual(dressDay([t1, b, s, coat], { temp: "cold", rain: false }, new Set())?.map((p) => p.id), [t1.id, b.id, s.id, coat.id]);
  assert.equal(dressDay([t1, b], MILD, new Set()), null);
});

test("invalid model days are repaired, impossible ones say what's missing", () => {
  const closet = [piece("top"), piece("top"), piece("bottom"), piece("shoes")];
  const pool = tripPool(closet, [day(0, MILD)]);
  const plan = planDays({ days: [{ pieces: [0, 2, 3], why: "Easy." }, { pieces: [0, 1, 3], why: "Two tops, no bottom." }] }, pool,
    [day(0, MILD), day(1, MILD), day(2, { temp: "cold", rain: true })]);
  assert.deepEqual(plan.days[0].pieces, [pool[0].id, pool[2].id, pool[3].id]);
  assert.equal(plan.days[0].why, "Easy.");
  assert.equal(plan.days[1].pieces.length, 3); // repaired by the code
  assert.equal(plan.days[1].why, "");
  assert.deepEqual(plan.days[2].pieces, []);
  assert.ok(plan.days[2].missing.some((m) => m.includes("coat")));
  assert.equal(plan.capsule.length, 3); // the repair reused what was packed
  assert.equal(plan.outfits, 1);
});

test("trips near a year out read the archive from two years back", () => {
  assert.equal(archiveStart("2027-03-01", 5, "2026-10-14"), "2026-03-01");
  assert.equal(archiveStart("2027-10-10", 14, "2026-10-14"), "2025-10-10"); // last year's dates aren't archived yet
});
