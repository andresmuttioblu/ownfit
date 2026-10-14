"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { ArrowUpRight, RefreshCw, Sparkle } from "lucide-react";
import { QuestionTag, SwingingHanger } from "@/components/illustrations";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import type { BuyList as List } from "@/lib/lists/buy";
import { shoppingUrl } from "@/lib/lists/shopping";
import { refreshBuyList } from "./actions";

const updated = (iso: string) => {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days < 1 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

/** What to buy next: one item per row, why, how many outfits it unlocks, and a plain shopping search. */
export function BuyList({ initial }: { initial: List | null }) {
  const [list, setList] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await refreshBuyList();
        if (r.ok) setList(r.list);
        else setError(r.error);
      } catch (e) {
        console.error(e);
        setError("Couldn't reach Ownfit. Check your connection and try again.");
      }
    });
  }

  if (pending) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground" aria-live="polite">
        <SwingingHanger className="h-16" />
        <p className="text-sm">Looking for what&apos;s missing…</p>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="rise-in flex flex-col items-center gap-4 py-10 text-center">
        <QuestionTag className="h-20 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">What would make your closet click?</p>
          <p className="max-w-[32ch] text-sm text-pretty text-muted-foreground">Ownfit looks for outfits you can&apos;t make yet and names the few pieces that would fix that.</p>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <Button size="lg" onClick={refresh}><Sparkle aria-hidden />Find what&apos;s missing</Button>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Updated {updated(list.generatedAt)}</p>
        <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={refresh}><RefreshCw aria-hidden />Refresh</Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <ol className="flex flex-col gap-2">
        {list.items.map((item, i) => (
          <li key={item.name} className="rise-in flex flex-col gap-2 rounded-2xl bg-muted p-4" style={{ "--i": i } as CSSProperties}>
            <div className="flex flex-col gap-0.5">
              <p className="font-medium first-letter:uppercase">{item.name}</p>
              <p className="text-sm text-pretty text-muted-foreground">{item.reason}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">
                {item.outfits > 0
                  ? <>{item.outfits} new {item.outfits === 1 ? "outfit" : "outfits"}{item.newActivities.length > 0 && <span className="text-muted-foreground"> · first for {item.newActivities.join(", ")}</span>}</>
                  : <>Fills a gap <span className="text-muted-foreground">for {item.fillsFor.join(", ")}</span></>}
              </p>
              <Button size="sm" variant="ghost" className="-mr-2 shrink-0" nativeButton={false}
                render={<a href={shoppingUrl(item.name)} target="_blank" rel="noopener noreferrer" />}>
                Search<ArrowUpRight aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-center text-xs text-muted-foreground">Search opens Google Shopping. Ownfit doesn&apos;t sell anything or earn from links.</p>
    </section>
  );
}
