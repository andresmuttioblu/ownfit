"use client";

import { useState, useTransition } from "react";
import type { Unlock, Weather } from "@/lib/outfits/filter";
import { outfitsFor, type TodayResult } from "@/app/_today/actions";
import { localToday } from "@/app/_today/outfit-card";
import { Result } from "@/app/_today/today";
import { SwingingHanger } from "@/components/illustrations";
import { UnlockRows } from "./ui";

const BASE_CATEGORIES = new Set(["top", "bottom", "dress", "one-piece", "swimwear", "shoes"]); // layers and extras join outfits that already exist

/** After adding a piece: what it adds per activity, and outfits with it on request. */
export function Unlocks({ garmentId, category, unlocks, weather }: { garmentId: string; category: string; unlocks: Unlock[]; weather: Weather }) {
  const [activity, setActivity] = useState<string | null>(null);
  const [result, setResult] = useState<TodayResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (!unlocks.length) {
    return <p className="text-sm text-pretty text-muted-foreground">It doesn&apos;t complete an outfit yet. Add the pieces it goes with and it will show up in suggestions.</p>;
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
      <h2 className="text-lg font-semibold">{unlocks.some((u) => u.isNew) || BASE_CATEGORIES.has(category) ? "New outfits this unlocks" : "Outfits it goes with"}</h2>
      <UnlockRows unlocks={unlocks} active={activity} disabled={pending} onPick={show} />
      <p className="text-xs text-muted-foreground">Counts ignore the weather; outfits use today&apos;s ({weather.temp}{weather.rain ? ", rain" : ""}).</p>
      {pending && (
        <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground" aria-live="polite">
          <SwingingHanger className="h-14" />
          <p className="text-sm">Putting outfits together…</p>
        </div>
      )}
      {result && activity && <Result result={result} activity={activity} weather={weather} />}
    </section>
  );
}
