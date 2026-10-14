"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Unlock, Weather } from "@/lib/outfits/filter";
import { outfitsFor, type TodayResult } from "@/app/_today/actions";
import { localToday } from "@/app/_today/outfit-card";
import { Result } from "@/app/_today/today";

const BASE_CATEGORIES = new Set(["top", "bottom", "dress", "one-piece", "swimwear", "shoes"]); // layers and extras join outfits that already exist

/** After adding a piece: what it adds per activity, and outfits with it on request. */
export function Unlocks({ garmentId, category, unlocks, weather }: { garmentId: string; category: string; unlocks: Unlock[]; weather: Weather }) {
  const [activity, setActivity] = useState<string | null>(null);
  const [result, setResult] = useState<TodayResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (!unlocks.length) {
    return <p className="text-sm text-muted-foreground">It doesn&apos;t complete an outfit yet. Add the pieces it goes with and it will show up in suggestions.</p>;
  }

  function show(a: string) {
    setActivity(a);
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await outfitsFor(a, weather, localToday(), garmentId));
      } catch (e) {
        console.error(e);
        setResult({ kind: "error", error: "Couldn't reach Ownfit. Check your connection and try again." });
      }
    });
  }

  return (
    <section className="flex w-full flex-col gap-3 text-left">
      <h2 className="font-medium">{unlocks.some((u) => u.isNew) || BASE_CATEGORIES.has(category) ? "New outfits this unlocks" : "Outfits it goes with"}</h2>
      <ul className="flex flex-col gap-2">
        {unlocks.map((u) => (
          <li key={u.activity} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <span className="text-sm">
              <span className="font-medium capitalize">{u.activity}</span>: {u.outfits} {u.outfits === 1 ? "outfit" : "outfits"}
              {u.isNew && <span className="block text-xs text-emerald-700">You couldn&apos;t make a {u.activity} outfit before.</span>}
            </span>
            <Button size="sm" variant={activity === u.activity ? "default" : "outline"} disabled={pending} onClick={() => show(u.activity)}>See outfits</Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Counts ignore the weather; outfits use today&apos;s ({weather.temp}{weather.rain ? ", rain" : ""}).</p>
      {pending && <p className="text-muted-foreground" aria-live="polite">Putting outfits together…</p>}
      {result && activity && <Result result={result} activity={activity} weather={weather} />}
    </section>
  );
}
