"use client";

import { useState, type CSSProperties } from "react";
import { Archive, CalendarX, Check, CircleCheck, PackageX, Shuffle, ThumbsDown, ThumbsUp } from "lucide-react";
import { FlatLay } from "@/components/flat-lay";
import { GarmentImage } from "@/components/garment-tile";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import type { Weather } from "@/lib/outfits/filter";
import { notToday, recordOutfit, retireGarment, swapPiece, type ActionResult, type Outfit, type OutfitPiece } from "./actions";

/** The phone's calendar date (YYYY-MM-DD): "not today" and outfit history follow the user's day, not the server's. */
export const localToday = () => new Date().toLocaleDateString("en-CA");

const OFFLINE = "Couldn't reach Ownfit. Check your connection and try again.";
const call = <T,>(p: Promise<T>, fallback: T) => p.catch((e) => { console.error(e); return fallback; });

type Props = { outfit: Outfit; activity: string; weather: Weather; index?: number };

/** One suggested outfit: tap a piece to set it aside, swap or retire it; rate or log the outfit as a whole. */
export function OutfitCard({ outfit, activity, weather, index = 0 }: Props) {
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

  const ghost = "text-muted-foreground hover:text-foreground";
  return (
    <article className="rise-in flex flex-col gap-3" style={{ "--i": index } as CSSProperties}>
      <div className="rounded-3xl bg-muted p-2">
        <FlatLay pieces={pieces} tile={(p) => (
          <button type="button" aria-pressed={selected === p.id} aria-label={p.name} disabled={busy}
            className={`block w-full rounded-2xl outline-none transition-[opacity,box-shadow,transform] duration-200 ease-(--ease-out-quart) focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] ${selected === p.id ? "ring-2 ring-primary ring-offset-2 ring-offset-muted" : selected ? "opacity-50" : ""}`}
            onClick={() => select(selected === p.id ? null : p.id)}>
            <GarmentImage src={p.imageUrl} className="rounded-2xl" />
          </button>
        )} />
      </div>

      {piece && (
        <div key={piece.id + retiring} className="rise-in flex flex-col gap-1.5 px-1">
          <p className="text-sm font-medium">{retiring ? `Retire ${piece.name}?` : piece.name}</p>
          <div className="-ml-2.5 flex flex-wrap gap-1">
            {retiring ? (
              <>
                <Button size="sm" variant="ghost" className={ghost} disabled={busy} onClick={() => setAside(piece, retireGarment(piece.id, "dislike"))}><ThumbsDown aria-hidden />Don&apos;t like it</Button>
                <Button size="sm" variant="ghost" className={ghost} disabled={busy} onClick={() => setAside(piece, retireGarment(piece.id, "no_longer_owned"))}><PackageX aria-hidden />Don&apos;t have it</Button>
                <Button size="sm" variant="ghost" className={ghost} disabled={busy} onClick={() => setRetiring(false)}>Cancel</Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" className={ghost} disabled={busy} onClick={() => setAside(piece, notToday(piece.id, localToday()))}><CalendarX aria-hidden />Not today</Button>
                <Button size="sm" variant="ghost" className={ghost} disabled={busy} onClick={() => run(() => replace(piece, false))}><Shuffle aria-hidden />Swap</Button>
                <Button size="sm" variant="ghost" className={ghost} disabled={busy} onClick={() => setRetiring(true)}><Archive aria-hidden />Retire</Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 px-1">
        <p className="flex-1 pt-2 text-[0.9375rem] leading-snug text-pretty">{outfit.why}</p>
        <div className="flex shrink-0">
          <Button size="icon" variant="ghost" className={wore ? "text-success" : ghost} disabled={busy || wore || incomplete} aria-label={wore ? "Worn today" : "I wore this"} aria-pressed={wore} onClick={() => log("wore")}>
            {wore ? <CircleCheck aria-hidden /> : <Check aria-hidden />}
          </Button>
          <Button size="icon" variant="ghost" className={rated === "like" ? "text-primary" : ghost} disabled={busy || !!rated || incomplete} aria-label="I like this outfit" aria-pressed={rated === "like"} onClick={() => log("like")}>
            <ThumbsUp className={rated === "like" ? "fill-current" : ""} aria-hidden />
          </Button>
          <Button size="icon" variant="ghost" className={rated === "dislike" ? "text-primary" : ghost} disabled={busy || !!rated || incomplete} aria-label="I don't like this outfit" aria-pressed={rated === "dislike"} onClick={() => log("dislike")}>
            <ThumbsDown className={rated === "dislike" ? "fill-current" : ""} aria-hidden />
          </Button>
        </div>
      </div>
      {wore && <p className="-mt-2 px-1 text-xs text-success" aria-live="polite">Saved as worn today.</p>}
      {busy && <p className="px-1 text-xs text-muted-foreground" aria-live="polite">Working…</p>}
      {error && <Notice tone="error" className="mx-1">{error}</Notice>}
    </article>
  );
}
