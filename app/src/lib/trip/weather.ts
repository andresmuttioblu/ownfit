// Trip weather from Open-Meteo (free, no key): the forecast when the trip is close, last year's same dates when it's further out.
import type { Temp, Weather } from "@/lib/outfits/filter";

export const MAX_DAYS = 14;
export const MAX_DESTINATION = 100;
const FORECAST_DAYS = 16; // how far ahead Open-Meteo forecasts, today included
const ARCHIVE_LAG_DAYS = 6; // the archive trails today by a few days
const RAINY_MM = 2; // a day with at least this much rain counts as rainy
const TIMEOUT_MS = 8_000;
// daily high (°C) → the closet's temperature words, warmest first
const HIGHS: [number, Temp][] = [[28, "hot"], [22, "warm"], [15, "mild"], [8, "cool"]];

export type Source = "forecast" | "last-year";
export type TripWeather = { place: string; source: Source; days: Weather[] };
export type WeatherResult = { ok: true; weather: TripWeather } | { ok: false; error: string };

export const isDestination = (s: unknown): s is string =>
  typeof s === "string" && !!s.trim() && s.trim().length <= MAX_DESTINATION && !/[\p{Cc}]/u.test(s);

/** One day's high and rain in the closet's words; a missing value reads as mild and dry. */
export function toWeather(highC: unknown, rainMm: unknown): Weather {
  const high = typeof highC === "number" && Number.isFinite(highC) ? highC : null;
  const temp = high === null ? "mild" : HIGHS.find(([min]) => high >= min)?.[1] ?? "cold";
  return { temp, rain: typeof rainMm === "number" && rainMm >= RAINY_MM };
}

/** YYYY-MM-DD plus n days (UTC, so no daylight-saving drift). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The forecast covers the whole trip only when its last day is within the forecast window. */
export const sourceFor = (start: string, days: number, today: string): Source =>
  addDays(start, days - 1) <= addDays(today, FORECAST_DAYS - 1) ? "forecast" : "last-year";

/** First day to read from the archive: the same dates last year, or two years back when last year's run hasn't been archived yet. */
export function archiveStart(start: string, days: number, today: string): string {
  const lastYear = addDays(start, -365);
  return addDays(lastYear, days - 1) <= addDays(today, -ARCHIVE_LAG_DAYS) ? lastYear : addDays(start, -730);
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  return res.json();
}

type Place = { name: string; country?: string; latitude: number; longitude: number };
const isPlace = (p: unknown): p is Place => {
  const x = p as Place;
  return typeof x === "object" && x !== null && typeof x.name === "string"
    && Number.isFinite(x.latitude) && Math.abs(x.latitude) <= 90 && Number.isFinite(x.longitude) && Math.abs(x.longitude) <= 180;
};

/** The daily weather for the trip, or a plain reason it couldn't be looked up. */
export async function tripWeather(destination: string, start: string, days: number, today: string): Promise<WeatherResult> {
  try {
    const found = await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=${encodeURIComponent(destination.trim())}`);
    const place = (found as { results?: unknown[] }).results?.[0];
    if (!isPlace(place)) return { ok: false, error: `Couldn't find “${destination.trim()}”. Try the nearest city.` };

    const source = sourceFor(start, days, today);
    const from = source === "forecast" ? start : archiveStart(start, days, today);
    const host = source === "forecast" ? "api.open-meteo.com/v1/forecast" : "archive-api.open-meteo.com/v1/archive";
    const daily = (await getJson(`https://${host}?latitude=${place.latitude}&longitude=${place.longitude}`
      + `&daily=temperature_2m_max,precipitation_sum&timezone=auto&start_date=${from}&end_date=${addDays(from, days - 1)}`) as {
      daily?: { temperature_2m_max?: unknown[]; precipitation_sum?: unknown[] };
    }).daily;
    const highs = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : [];
    const rain = Array.isArray(daily?.precipitation_sum) ? daily.precipitation_sum : [];
    const name = [place.name, place.country].filter((s) => typeof s === "string" && s).join(", ").slice(0, MAX_DESTINATION);
    return { ok: true, weather: { place: name, source, days: Array.from({ length: days }, (_, i) => toWeather(highs[i], rain[i])) } };
  } catch (e) {
    console.error("trip weather failed", e);
    return { ok: false, error: "Couldn't get the weather right now. Set each day by hand instead." };
  }
}
