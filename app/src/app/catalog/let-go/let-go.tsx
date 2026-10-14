"use client";

import { useState, type CSSProperties } from "react";
import { Heart, PackageOpen } from "lucide-react";
import { localToday } from "@/app/_today/outfit-card";
import { GarmentImage } from "@/components/garment-tile";
import { EmptyRail } from "@/components/illustrations";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import type { LetGoReason } from "@/lib/lists/let-go";
import { keep, letGo, type ListAction } from "./actions";

export type LetGoRow = { id: string; name: string; imageUrl: string; reason: LetGoReason; detail: string };

const TITLES: Record<LetGoReason, string> = { disliked: "You said you don't like these", not_worn: "Not worn in a year", duplicate: "More than you need" };
const ORDER: LetGoReason[] = ["disliked", "not_worn", "duplicate"];

/** Pieces that might be ready to go, grouped by why; each can be let go or kept. */
export function LetGo({ rows: initial }: { rows: LetGoRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null); // "let it go" takes a second tap
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: () => Promise<ListAction>) {
    setBusy((b) => new Set(b).add(id));
    setError(null);
    const r = await action().catch((e) => { console.error(e); return { ok: false as const, error: "Couldn't reach Ownfit. Check your connection and try again." }; });
    setBusy((b) => { const next = new Set(b); next.delete(id); return next; });
    if (r.ok) setRows((cur) => cur.filter((row) => row.id !== id));
    else setError(r.error);
  }

  if (!rows.length) {
    return (
      <div className="rise-in flex flex-col items-center gap-4 py-10 text-center">
        <EmptyRail className="h-20 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">Everything here earns its hanger</p>
          <p className="max-w-[32ch] text-sm text-pretty text-muted-foreground">Pieces you don&apos;t wear for a year, don&apos;t like or have too many of will show up here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <Notice tone="error">{error}</Notice>}
      {ORDER.filter((reason) => rows.some((r) => r.reason === reason)).map((reason) => (
        <section key={reason} className="flex flex-col gap-2" aria-label={TITLES[reason]}>
          <h2 className="text-sm font-medium text-muted-foreground">{TITLES[reason]}</h2>
          <ul className="flex flex-col gap-2">
            {rows.filter((r) => r.reason === reason).map((row, i) => (
              <li key={row.id} className="rise-in flex items-center gap-3 rounded-2xl bg-muted p-2 pr-3" style={{ "--i": i } as CSSProperties}>
                <GarmentImage src={row.imageUrl} className="size-16 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
                </div>
                <div className="flex shrink-0">
                  <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-foreground" disabled={busy.has(row.id)}
                    aria-label={`Keep ${row.name}`} title="Keep" onClick={() => act(row.id, () => keep(row.id, localToday()))}><Heart aria-hidden /></Button>
                  {confirming === row.id ? (
                    <Button size="sm" className="rise-in my-auto" disabled={busy.has(row.id)} onBlur={() => setConfirming(null)}
                      autoFocus onClick={() => act(row.id, () => letGo(row.id))}>Let it go</Button>
                  ) : (
                    <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-foreground" disabled={busy.has(row.id)}
                      aria-label={`Let ${row.name} go`} title="Let it go" onClick={() => setConfirming(row.id)}><PackageOpen aria-hidden /></Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-center text-xs text-pretty text-muted-foreground">Keep hides a piece here for a year. Let it go removes it from your closet for good.</p>
    </div>
  );
}
