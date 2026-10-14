"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, Cloud, CloudSun, Plus, Snowflake, Sun, ThermometerSun, Umbrella, type LucideIcon } from "lucide-react";
import { EmptyHanger, SwingingHanger } from "@/components/illustrations";
import { activityIcon } from "./activity-icon";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { TEMPS, type Temp, type Weather } from "@/lib/outfits/filter";

const TEMP_ICONS: Record<Temp, LucideIcon> = { hot: ThermometerSun, warm: Sun, mild: CloudSun, cool: Cloud, cold: Snowflake };
import { outfitsFor, setWeather, type TodayResult } from "./actions";
import { localToday, OutfitCard } from "./outfit-card";

/** "What are you doing today?": weather, activity buttons, and the suggested outfits. */
export function Today({ activities, initialWeather, children }: { activities: string[]; initialWeather: Weather; children?: React.ReactNode }) {
  const [weatherOpen, setWeatherOpen] = useState(false);
  const weatherButton = useRef<HTMLButtonElement>(null);
  const [otherOpen, setOtherOpen] = useState(false);
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
        r = await outfitsFor(a, weather, localToday());
      } catch (e) {
        console.error(e);
        r = { kind: "error", error: "Couldn't reach Ownfit. Check your connection and try again." };
      }
      if (id === latest.current) setResult(r);
    });
  }

  const TempIcon = TEMP_ICONS[weather.temp];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <span className="text-[0.9375rem] font-semibold tracking-tight">Ownfit</span>
        <button ref={weatherButton} type="button" aria-expanded={weatherOpen} aria-controls="weather-picker" aria-label={`Weather: ${weather.temp}${weather.rain ? ", rain" : ""}`}
          className="flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted aria-expanded:text-foreground"
          onClick={() => setWeatherOpen((o) => !o)}>
          <TempIcon className="size-4" aria-hidden />
          <span className="capitalize">{weather.temp}</span>
          {weather.rain && <Umbrella className="size-4" aria-hidden />}
        </button>
      </header>

      <div id="weather-picker" className={`-mt-3 grid transition-[grid-template-rows,opacity] duration-200 ease-(--ease-out-quart) ${weatherOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} inert={!weatherOpen}>
        <div className="overflow-hidden">
          <div className="flex items-stretch gap-1 pt-1" role="group" aria-label="Today's weather">
            {TEMPS.map((t) => {
              const Icon = TEMP_ICONS[t];
              const on = weather.temp === t;
              return (
                <button key={t} type="button" aria-pressed={on}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs font-medium capitalize transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  onClick={() => { changeWeather({ ...weather, temp: t }); setWeatherOpen(false); weatherButton.current?.focus(); }}>
                  <Icon className="size-5" aria-hidden />{t}
                </button>
              );
            })}
            <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
            <button type="button" aria-pressed={weather.rain}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring ${weather.rain ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              onClick={() => changeWeather({ ...weather, rain: !weather.rain })}>
              <Umbrella className="size-5" aria-hidden />rain
            </button>
          </div>
        </div>
      </div>
      {weatherError && <Notice tone="warning">Couldn&apos;t save this as your usual weather. It still applies right now.</Notice>}

      {children}

      <section className="flex flex-col gap-4">
        <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">What are you doing today?</h1>
        <div className="flex flex-col gap-2">
          {activities.map((a) => {
            const Icon = activityIcon(a);
            const on = activity === a;
            return (
              <button key={a} type="button" aria-pressed={on} disabled={pending}
                className={`group flex h-16 items-center gap-3.5 rounded-2xl px-4 text-left transition-[background-color,color,transform] duration-150 ease-(--ease-out-quart) outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] disabled:opacity-50 ${on ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}
                onClick={() => ask(a)}>
                <Icon className={`size-5 shrink-0 ${on ? "" : "text-muted-foreground"}`} aria-hidden />
                <span className="flex-1 text-base font-medium capitalize">{a}</span>
                <ChevronRight className={`size-4 transition-transform duration-150 group-hover:translate-x-0.5 ${on ? "" : "text-muted-foreground"}`} aria-hidden />
              </button>
            );
          })}
          {otherOpen ? (
            <form className="flex h-16 items-center gap-2 rounded-2xl bg-muted pr-2 pl-4"
              onSubmit={(e) => { e.preventDefault(); if (other.trim()) ask(other.trim()); }}>
              <input autoFocus value={other} maxLength={80} placeholder="A picnic, a wedding…" aria-label="Something else"
                className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                onChange={(e) => setOther(e.target.value)} />
              <Button type="submit" size="icon-lg" className="rounded-xl" aria-label="Get outfits" disabled={pending || !other.trim()}><ArrowRight aria-hidden /></Button>
            </form>
          ) : (
            <button type="button" className="flex h-16 items-center gap-3.5 rounded-2xl border border-dashed px-4 text-left text-muted-foreground transition-[color,transform] duration-150 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
              onClick={() => setOtherOpen(true)}>
              <Plus className="size-5 shrink-0" aria-hidden />
              <span className="text-base font-medium">Something else</span>
            </button>
          )}
        </div>
      </section>

      {pending && (
        <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground" aria-live="polite">
          <SwingingHanger className="h-14" />
          <p className="text-sm">Putting outfits together…</p>
        </div>
      )}
      {result && activity && <Result result={result} activity={activity} weather={weather} />}
    </div>
  );
}

export function Result({ result, activity, weather }: { result: TodayResult; activity: string; weather: Weather }) {
  if (result.kind === "error") return <Notice tone="error">{result.error}</Notice>;
  if (result.kind === "missing") {
    return (
      <div className="rise-in flex flex-col items-center gap-3 py-4 text-center">
        <EmptyHanger className="h-14 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">This hanger is feeling lonely</p>
          <p className="max-w-[32ch] text-sm text-pretty text-muted-foreground">A {result.activity} outfit for {result.weather.temp}{result.weather.rain ? ", rainy" : ""} weather still needs {result.missing.join("; ")}. Add one and it&apos;s ready.</p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/add" />}><Plus aria-hidden />Add a piece</Button>
      </div>
    );
  }
  return (
    <section className="flex flex-col gap-5" aria-live="polite" aria-label="Outfits">
      {result.needs.length > 0 && <p className="text-sm text-muted-foreground">You might need {result.needs.join(", ")}.</p>}
      {result.outfits.map((o, i) => <OutfitCard key={i} index={i} outfit={o} activity={activity} weather={weather} />)}
    </section>
  );
}
