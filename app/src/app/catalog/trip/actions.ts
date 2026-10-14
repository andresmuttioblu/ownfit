"use server";

import { and, eq, sql } from "drizzle-orm";
import { activeCloset, FAILED, isActivity, isWeather, SESSION_EXPIRED, signedIn, UUID } from "@/app/_today/closet";
import { db } from "@/db";
import { users } from "@/db/schema";
import { currentUser } from "@/db/user";
import { isLocalDate } from "@/lib/outfits/feedback";
import { summarize } from "@/lib/style/profile";
import { packCapsule, type TripDay } from "@/lib/trip/capsule";
import { addDays, isDestination, MAX_DAYS, MAX_DESTINATION, tripWeather, type Source, type WeatherResult } from "@/lib/trip/weather";
import { hourlyLimiter } from "@/lib/upload";
import { tripView, type TripView } from "./view";

const lookupLimit = hourlyLimiter(30);
const packLimit = hourlyLimiter(10); // a trip is planned once or twice; the Anthropic spend limit is the real cap
const MAX_AHEAD_DAYS = 366;
const SOURCES: Source[] = ["forecast", "last-year"];
const TOO_MANY = "That's a lot of trips in an hour. Try again later.";

const serverToday = () => new Date().toISOString().slice(0, 10);
const isDays = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_DAYS;
// a day either side of the server's date covers every time zone
const isTripStart = (s: unknown): s is string => isLocalDate(s) && s >= addDays(serverToday(), -1) && s <= addDays(serverToday(), MAX_AHEAD_DAYS);

export async function checkWeather(destination: string, start: string, days: number): Promise<WeatherResult> {
  if (!(await signedIn())) return { ok: false, error: SESSION_EXPIRED };
  if (!isDestination(destination)) return { ok: false, error: `Type a city or place (up to ${MAX_DESTINATION} characters).` };
  if (!isTripStart(start) || !isDays(days)) return { ok: false, error: `Pick a start date within a year and 1 to ${MAX_DAYS} days.` };
  if (lookupLimit()) return { ok: false, error: TOO_MANY };
  return tripWeather(destination, start, days, serverToday());
}

export type PackInput = { destination: string; place: string | null; source: Source | null; days: TripDay[] };
export type PackResult = { ok: true; view: TripView } | { ok: false; error: string };

const isTripDays = (days: unknown): days is TripDay[] =>
  Array.isArray(days) && isDays(days.length)
  && days.every((d: TripDay, i) => isLocalDate(d?.date) && isWeather(d.weather) && isActivity(d.activity) && (i === 0 || d.date === addDays(days[0].date, i)));

/** Plans the capsule and saves it as the current trip, replacing the last one. */
export async function packTrip(input: PackInput): Promise<PackResult> {
  if (!(await signedIn())) return { ok: false, error: SESSION_EXPIRED };
  const { destination, place, source, days } = input ?? {};
  if (!isDestination(destination) || !(place === null || isDestination(place)) || !(source === null || SOURCES.includes(source))
    || !isTripDays(days) || !isTripStart(days[0].date)) return { ok: false, error: FAILED };
  if (packLimit()) return { ok: false, error: TOO_MANY };
  try {
    const user = await currentUser();
    const clean = days.map((d) => ({ date: d.date, weather: { temp: d.weather.temp, rain: d.weather.rain }, activity: d.activity.trim() }));
    const result = await packCapsule(await activeCloset(user.id), clean, destination.trim(), user.styleProfile ? summarize(user.styleProfile) : null);
    if (!result.ok) return result;
    const trip = { destination: destination.trim(), place, source, generatedAt: new Date().toISOString(), days: result.days, capsule: result.capsule, outfits: result.outfits, packed: [] };
    await db.update(users).set({ trip }).where(eq(users.id, user.id));
    return { ok: true, view: await tripView(user.id, trip) };
  } catch (e) {
    console.error("pack trip failed", e);
    return { ok: false, error: FAILED };
  }
}

/** Saves what's ticked on the packing list. The phone sends the whole list, so quick taps can't undo each other. */
export async function setPacked(garmentIds: string[]): Promise<{ ok: boolean }> {
  if (!(await signedIn()) || !Array.isArray(garmentIds) || !garmentIds.every((id) => typeof id === "string" && UUID.test(id))) return { ok: false };
  try {
    const user = await currentUser();
    if (!user.trip) return { ok: false };
    const packed = user.trip.capsule.filter((id) => garmentIds.includes(id));
    // only the packed field, so a new trip saved meanwhile isn't overwritten by this one
    await db.update(users).set({ trip: sql`jsonb_set(${users.trip}, '{packed}', ${JSON.stringify(packed)}::jsonb)` })
      .where(and(eq(users.id, user.id), sql`${users.trip}->>'generatedAt' = ${user.trip.generatedAt}`));
    return { ok: true };
  } catch (e) {
    console.error("set packed failed", e);
    return { ok: false };
  }
}
