"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Weather } from "@/lib/outfits/filter";
import { notToday, recordOutfit, retireGarment, swapPiece, type ActionResult, type Outfit, type OutfitPiece } from "./actions";

/** The phone's calendar date (YYYY-MM-DD): "not today" and outfit history follow the user's day, not the server's. */
export const localToday = () => new Date().toLocaleDateString("en-CA");

const OFFLINE = "Couldn't reach Ownfit. Check your connection and try again.";
const call = <T,>(p: Promise<T>, fallback: T) => p.catch((e) => { console.error(e); return fallback; });

type Props = { outfit: Outfit; activity: string; weather: Weather };

/** One suggested outfit: tap a piece to set it aside, swap or retire it; rate or log the outfit as a whole. */
export function OutfitCard({ outfit, activity, weather }: Props) {
  const [pieces, setPieces] = useState(outfit.pieces);
  const [selected, setSelected] = useState<string | null>(null);
  const [retiring, setRetiring] = useState(false);
  const [rated, setRated] = useState<"like" | "dislike" | null>(null);
  const [wore, setWore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [incomplete, setIncomplete] = useState(false); // a piece left with nothing to replace it
  const [error, setError] = useState<string | null>(null);
  const piece = pieces.find((p) => p.id === selected);

  function select(id: string | null) {
    setSelected(id);
    setRetiring(false);
    setError(null);
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  }

  /** Replace a piece; when it already left the closet (not today, retired) and nothing fits, drop it. */
  async function replace(out: OutfitPiece, gone: boolean) {
    const ids = pieces.map((p) => p.id);
    const r = await call(swapPiece(ids, out.id, activity, weather, localToday()), { ok: false as const, error: OFFLINE });
    if (r.ok) setPieces((cur) => cur.map((p) => (p.id === out.id ? r.piece : p)));
    else if (gone) {
      setPieces((cur) => cur.filter((p) => p.id !== out.id));
      setIncomplete(true);
    }
    if (r.ok || gone) {
      setRated(null); // a rating was for the old set of pieces
      setWore(false);
    }
    select(null);
    if (!r.ok) setError(r.error);
  }

  const setAside = (out: OutfitPiece, action: Promise<ActionResult>) => run(async () => {
    const r = await call(action, { ok: false, error: OFFLINE });
    if (!r.ok) return setError(r.error);
    await replace(out, true);
  });

  const log = (kind: "wore" | "like" | "dislike") => run(async () => {
    const r = await call(recordOutfit(kind, pieces.map((p) => p.id), activity, localToday()), { ok: false, error: OFFLINE });
    if (!r.ok) return setError(r.error);
    if (kind === "wore") setWore(true);
    else setRated(kind);
  });

  return (
    <article className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="grid grid-cols-3 gap-2">
        {pieces.map((p) => (
          <button key={p.id} type="button" aria-pressed={selected === p.id} disabled={busy}
            className={`flex flex-col gap-1 rounded-md text-left ${selected === p.id ? "ring-2 ring-foreground ring-offset-2" : ""}`}
            onClick={() => select(selected === p.id ? null : p.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL */}
            <img src={p.imageUrl} alt="" className="aspect-square w-full rounded-md border bg-white object-contain" />
            <span className="truncate text-xs text-muted-foreground">{p.name}</span>
          </button>
        ))}
      </div>

      {piece && !retiring && (
        <div className="flex flex-wrap gap-2" aria-label={`Actions for ${piece.name}`}>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setAside(piece, notToday(piece.id, localToday()))}>Not today</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => replace(piece, false))}>Swap</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setRetiring(true)}>Retire</Button>
        </div>
      )}
      {piece && retiring && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Retire {piece.name}?</span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setAside(piece, retireGarment(piece.id, "dislike"))}>I don&apos;t like it</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setAside(piece, retireGarment(piece.id, "no_longer_owned"))}>I don&apos;t have it</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRetiring(false)}>Cancel</Button>
        </div>
      )}

      <p className="text-sm">{outfit.why}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={wore ? "default" : "outline"} disabled={busy || wore || incomplete} onClick={() => log("wore")}>{wore ? "Worn today" : "Wore this"}</Button>
        <Button size="sm" variant={rated === "like" ? "default" : "outline"} disabled={busy || !!rated || incomplete} aria-label="I like this outfit" onClick={() => log("like")}>👍</Button>
        <Button size="sm" variant={rated === "dislike" ? "default" : "outline"} disabled={busy || !!rated || incomplete} aria-label="I don't like this outfit" onClick={() => log("dislike")}>👎</Button>
      </div>
      {busy && <p className="text-xs text-muted-foreground" aria-live="polite">Working…</p>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </article>
  );
}
