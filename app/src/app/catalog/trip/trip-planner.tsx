"use client";

import { useState, useTransition } from "react";
import { Check, Luggage, Sparkle } from "lucide-react";
import { activityIcon } from "@/app/_today/activity-icon";
import { localToday } from "@/app/_today/outfit-card";
import { ROW, rowTone, Wait } from "@/app/add/ui";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { DEFAULT_WEATHER, TEMPS, type Temp } from "@/lib/outfits/filter";
import type { TripDay } from "@/lib/trip/capsule";
import { addDays, MAX_DAYS, MAX_DESTINATION, type Source } from "@/lib/trip/weather";
import { checkWeather, packTrip } from "./actions";
import { dayLabel, TripResult } from "./trip-result";
import type { TripView } from "./view";

const OFFLINE = "Couldn't reach Ownfit. Check your connection and try again.";
const FIELD = "h-12 w-full rounded-xl bg-muted px-3 text-base outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";
const SMALL_SELECT = "h-11 rounded-xl bg-background px-2 text-sm capitalize outline-none ring-1 ring-border focus-visible:ring-2 focus-visible:ring-ring";

type Preview = { place: string | null; source: Source | null; days: TripDay[] };

/** Where, when and what for → check the weather → adjust any day → pack. */
export function TripPlanner({ activities, initial }: { activities: string[]; initial: TripView | null }) {
  const [view, setView] = useState(initial);
  const [destination, setDestination] = useState("");
  const [start, setStart] = useState(localToday);
  const [length, setLength] = useState(3);
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [packing, setPacking] = useState(false);

  function run(work: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try { await work(); } catch (e) { console.error(e); setError(OFFLINE); }
    });
  }

  const check = () => run(async () => {
    const r = await checkWeather(destination, start, length);
    const weathers = r.ok ? r.weather.days : Array.from({ length }, () => DEFAULT_WEATHER); // no lookup: set by hand
    if (!r.ok) setError(r.error);
    setPreview({
      place: r.ok ? r.weather.place : null, source: r.ok ? r.weather.source : null,
      days: weathers.map((weather, i) => ({ date: addDays(start, i), weather, activity: chosen[i % chosen.length] })),
    });
  });

  const pack = () => preview && run(async () => {
    setPacking(true);
    const r = await packTrip({ destination: destination.trim(), ...preview }).finally(() => setPacking(false));
    if (!r.ok) { setError(r.error); return; }
    setView(r.view);
    setPreview(null);
  });

  const editDay = (i: number, change: Partial<TripDay>) =>
    setPreview((p) => p && { ...p, days: p.days.map((d, j) => (j === i ? { ...d, ...change } : d)) });

  if (packing) return <Wait>Packing your bag…</Wait>;
  if (view) return <TripResult view={view} onNewTrip={() => { setView(null); setError(null); }} />;

  if (preview) {
    return (
      <section className="rise-in flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{preview.place ?? destination.trim()}</h2>
          <p className="text-sm text-muted-foreground">
            {preview.source === "forecast" ? "From the forecast. " : preview.source === "last-year" ? "Too far out for a forecast, so this is last year's weather for the same dates. " : ""}
            Change any day that looks off.
          </p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <ol className="flex flex-col gap-2">
          {preview.days.map((d, i) => (
            <li key={d.date} className="flex min-h-16 items-center gap-2 rounded-2xl bg-muted py-2 pr-2 pl-4">
              <span className="flex-1 text-sm font-medium">{dayLabel(d.date)}</span>
              <select aria-label={`Weather on ${dayLabel(d.date)}`} className={SMALL_SELECT}
                value={`${d.weather.temp}${d.weather.rain ? "+rain" : ""}`}
                onChange={(e) => { const [temp, rain] = e.target.value.split("+"); editDay(i, { weather: { temp: temp as Temp, rain: !!rain } }); }}>
                {TEMPS.flatMap((t) => [<option key={t} value={t}>{t}</option>, <option key={`${t}+rain`} value={`${t}+rain`}>{t}, rain</option>])}
              </select>
              <select aria-label={`Plans on ${dayLabel(d.date)}`} className={SMALL_SELECT} value={d.activity} onChange={(e) => editDay(i, { activity: e.target.value })}>
                {chosen.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2">
          <Button size="lg" disabled={pending} onClick={pack}><Luggage aria-hidden />Pack my bag</Button>
          <Button size="lg" variant="ghost" disabled={pending} onClick={() => { setPreview(null); setError(null); }}>Back</Button>
        </div>
      </section>
    );
  }

  const ready = destination.trim() && chosen.length > 0 && start;
  return (
    <form className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); if (ready) check(); }}>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Where to?</span>
        <input className={FIELD} value={destination} maxLength={MAX_DESTINATION} placeholder="Lisbon, Tokyo, the lake house…" autoComplete="off"
          onChange={(e) => setDestination(e.target.value)} />
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Leaving</span>
          <input type="date" className={FIELD} value={start} min={localToday()} max={addDays(localToday(), 365)} required
            onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="flex w-28 flex-col gap-1.5">
          <span className="text-sm font-medium">Days</span>
          <select className={FIELD} value={length} onChange={(e) => setLength(Number(e.target.value))}>
            {Array.from({ length: MAX_DAYS }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">What will you be doing?</legend>
        {activities.map((a) => {
          const Icon = activityIcon(a);
          const on = chosen.includes(a);
          return (
            <button key={a} type="button" aria-pressed={on} className={`${ROW} ${rowTone(on)}`}
              onClick={() => setChosen((c) => (on ? c.filter((x) => x !== a) : [...c, a]))}>
              <Icon className={`size-5 shrink-0 ${on ? "" : "text-muted-foreground"}`} aria-hidden />
              <span className="flex-1 text-base font-medium capitalize">{a}</span>
              {on && <Check className="size-5" aria-hidden />}
            </button>
          );
        })}
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      {pending ? <Wait>Checking the weather…</Wait> : <Button type="submit" size="lg" disabled={!ready}><Sparkle aria-hidden />Check the weather</Button>}
    </form>
  );
}
