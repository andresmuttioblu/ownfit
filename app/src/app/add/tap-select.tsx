"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Undo2 } from "lucide-react";
import { SwingingHanger } from "@/components/illustrations";
import { useObjectUrl } from "./ui";
import { Button } from "@/components/ui/button";
import type { Cutout } from "@/lib/catalog/cutout";
import type { Tap } from "@/lib/catalog/sam";

type Segment = (taps: Tap[]) => Promise<HTMLCanvasElement>;

/** The user taps the item on the photo; everything outside the selection is dimmed as they go. */
export function TapSelect({ photo, original, onDone, onCancel }: {
  photo: HTMLCanvasElement;
  original: Blob;
  onDone: (cutout: Cutout) => void;
  onCancel: () => void;
}) {
  const photoUrl = useObjectUrl(original);
  const [segment, setSegment] = useState<Segment | null>(null);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [include, setInclude] = useState(true);
  const [mask, setMask] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const overlay = useRef<HTMLCanvasElement>(null);
  const latest = useRef(0);

  useEffect(() => { // encoding the photo is the slow part; do it once
    let live = true;
    import("@/lib/catalog/sam")
      .then((m) => m.tapSegmenter(photo))
      .then((fn) => live && setSegment(() => fn))
      .catch((e) => { console.error(e); if (live) setError("Tap-to-select couldn't start. Check your connection and try again."); });
    return () => { live = false; };
  }, [photo]);

  useEffect(() => { // dim everything outside the selection (works on any garment color)
    const c = overlay.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    if (!mask) { ctx.clearRect(0, 0, c.width, c.height); return; }
    c.width = mask.width;
    c.height = mask.height;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }, [mask]);

  async function run(next: Tap[]) {
    setTaps(next);
    setError(null);
    const id = ++latest.current; // also cancels a decode still running for older taps
    if (!segment || !next.some((t) => t.include)) { setMask(null); return; }
    try {
      const m = await segment(next);
      if (id === latest.current) setMask(m); // a newer tap may have finished first
    } catch (e) {
      console.error(e);
      setError("Selecting failed. Try tapping again.");
    }
  }

  function onTap(e: React.MouseEvent<HTMLDivElement>) {
    if (!segment) return;
    const r = e.currentTarget.getBoundingClientRect();
    run([...taps, { x: ((e.clientX - r.left) / r.width) * photo.width, y: ((e.clientY - r.top) / r.height) * photo.height, include }]);
  }

  async function done() {
    if (!mask) return;
    setError(null);
    setBusy(true);
    try {
      const { onWhite } = await import("@/lib/catalog/cutout");
      onDone(await onWhite(photo, mask));
    } catch (e) {
      console.error(e);
      setError("Making the cutout failed. Try again.");
      setBusy(false);
    }
  }

  const seg = (on: boolean) => `flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-pretty text-muted-foreground" aria-live="polite">
        {error ?? (segment ? "Tap the item. Switch to “Not the item” to tap anything that got picked up by mistake." : "Getting ready…")}
      </p>
      {!segment && !error && <SwingingHanger className="mx-auto h-10 text-muted-foreground" />}
      <div className="relative mx-auto w-full max-w-sm cursor-crosshair touch-manipulation overflow-hidden rounded-2xl bg-muted select-none" onClick={onTap}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
        {photoUrl && <img src={photoUrl} alt="Your photo" className="block w-full" draggable={false} />}
        <canvas ref={overlay} className="pointer-events-none absolute inset-0 h-full w-full" />
        {taps.map((t, i) => (
          <span key={i} aria-hidden
            className={`pointer-events-none absolute size-4 -translate-1/2 rounded-full ring-2 ${t.include ? "bg-white ring-black" : "bg-black ring-white"}`}
            style={{ left: `${(t.x / photo.width) * 100}%`, top: `${(t.y / photo.height) * 100}%` }} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1 rounded-xl bg-muted p-1" role="group" aria-label="What to tap">
          <button type="button" className={seg(include)} aria-pressed={include} onClick={() => setInclude(true)}><Plus className="size-4" aria-hidden />The item</button>
          <button type="button" className={seg(!include)} aria-pressed={!include} onClick={() => setInclude(false)}><Minus className="size-4" aria-hidden />Not the item</button>
        </div>
        <Button variant="ghost" size="icon-lg" className="text-muted-foreground" aria-label="Undo last tap" onClick={() => run(taps.slice(0, -1))} disabled={!taps.length}><Undo2 aria-hidden /></Button>
      </div>
      <div className="flex flex-col gap-2">
        <Button size="lg" className="h-14 rounded-2xl text-base" onClick={done} disabled={!mask || busy}>{busy ? "Cutting out…" : "Use this"}</Button>
        <Button variant="ghost" size="lg" className="text-muted-foreground" onClick={onCancel} disabled={busy}>Back</Button>
      </div>
    </div>
  );
}
