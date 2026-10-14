"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TEMPS, type Weather } from "@/lib/outfits/filter";
import { outfitsFor, setWeather, type TodayResult } from "./actions";

const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm transition-colors ${on ? "border-foreground bg-foreground text-background" : "hover:bg-muted"}`;

/** "What are you doing today?": weather, activity buttons, and the suggested outfits. */
export function Today({ activities, initialWeather }: { activities: string[]; initialWeather: Weather }) {
  const [weather, setLocalWeather] = useState(initialWeather);
  const [activity, setActivity] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [result, setResult] = useState<TodayResult | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [pending, startTransition] = useTransition();
  const latest = useRef(0); // only the newest request may show its result

  async function changeWeather(next: Weather) {
    setLocalWeather(next);
    setResult(null); // suggestions were for the old weather
    latest.current++;
    const saved = await setWeather(next).catch(() => ({ ok: false }));
    setWeatherError(!saved.ok); // today's outfits still use it; only the saved default failed
  }

  function ask(a: string) {
    setActivity(a);
    setResult(null);
    const id = ++latest.current;
    startTransition(async () => {
      let r: TodayResult;
      try {
        r = await outfitsFor(a, weather);
      } catch (e) {
        console.error(e);
        r = { kind: "error", error: "Couldn't reach Ownfit. Check your connection and try again." };
      }
      if (id === latest.current) setResult(r);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2" aria-label="Today's weather">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Weather today</h2>
        <div className="flex flex-wrap gap-1.5">
          {TEMPS.map((t) => (
            <button key={t} type="button" aria-pressed={weather.temp === t} className={chip(weather.temp === t)}
              onClick={() => changeWeather({ ...weather, temp: t })}>{t}</button>
          ))}
          <button type="button" aria-pressed={weather.rain} className={chip(weather.rain)}
            onClick={() => changeWeather({ ...weather, rain: !weather.rain })}>rain</button>
        </div>
        {weatherError && <p role="alert" className="text-xs text-red-700">Couldn&apos;t save this as your default weather. It still applies right now.</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-medium">What are you doing today?</h2>
        <div className="grid grid-cols-2 gap-2">
          {activities.map((a) => (
            <Button key={a} variant={activity === a ? "default" : "outline"} className="h-12 capitalize" disabled={pending} onClick={() => ask(a)}>{a}</Button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (other.trim()) ask(other.trim()); }}>
          <Input value={other} maxLength={80} placeholder="Something else, e.g. a picnic" onChange={(e) => setOther(e.target.value)} />
          <Button type="submit" variant="outline" disabled={pending || !other.trim()}>Go</Button>
        </form>
      </section>

      {pending && <p className="text-muted-foreground" aria-live="polite">Putting outfits together…</p>}
      {result && <Result result={result} />}
    </div>
  );
}

function Result({ result }: { result: TodayResult }) {
  if (result.kind === "error") return <p role="alert" className="text-sm text-red-700">{result.error}</p>;
  if (result.kind === "missing") {
    return (
      <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Your catalog can&apos;t make a complete {result.activity} outfit for {result.weather.temp}{result.weather.rain ? ", rainy" : ""} weather yet.</p>
        <p>Missing: {result.missing.join("; ")}. Add one and try again.</p>
      </div>
    );
  }
  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      {result.needs.length > 0 && <p className="text-sm">You might need: {result.needs.join(", ")}</p>}
      {result.outfits.map((o, i) => (
        <article key={i} className="flex flex-col gap-2 rounded-xl border p-3">
          <div className="grid grid-cols-3 gap-2">
            {o.pieces.map((p) => (
              <figure key={p.id} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL */}
                <img src={p.imageUrl} alt={p.name} className="aspect-square w-full rounded-md border bg-white object-contain" />
                <figcaption className="truncate text-xs text-muted-foreground">{p.name}</figcaption>
              </figure>
            ))}
          </div>
          <p className="text-sm">{o.why}</p>
        </article>
      ))}
      <p className="text-xs text-muted-foreground">Ready in {(result.ms / 1000).toFixed(1)} s</p>
    </section>
  );
}
