"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AddGarment } from "@/app/add/add-garment";
import type { Outfit } from "@/app/_today/actions";
import { localToday } from "@/app/_today/outfit-card";
import type { GarmentTags } from "@/lib/catalog/vocabulary";
import type { Weather } from "@/lib/outfits/filter";
import type { Assessment } from "@/lib/outfits/fitting";
import { exampleOutfits, type ExampleResult } from "./actions";

const MAX_SIDE = 1600;
type Checked = Assessment & { tags: GarmentTags; notGarment: boolean };
type Step =
  | { kind: "pick" }
  | { kind: "working" }
  | { kind: "result"; photo: File; checked: Checked }
  | { kind: "bought"; photo: File };

async function check(file: File): Promise<{ photo: File; checked: Checked }> {
  const { loadPhoto, toBlob } = await import("@/lib/image");
  const canvas = await loadPhoto(file, MAX_SIDE);
  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  canvas.width = canvas.height = 0;
  const form = new FormData();
  form.set("image", jpeg, "item.jpg");
  const res = await fetch("/api/fitting-room", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Couldn't check that item. Try again.");
  return { photo: new File([jpeg], "item.jpg", { type: "image/jpeg" }), checked: body as Checked };
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

function headline({ verdict, sameKind, unlocks, tags }: Checked): string {
  const kind = `${tags.colors[0]} ${tags.subcategory.replace(/-/g, " ")}`;
  if (verdict === "duplicate") return `You already have this: it would be your ${ordinal(sameKind + 1)} ${kind}.`;
  if (verdict === "gap") return `Fills a gap: your first complete ${unlocks.filter((u) => u.isNew).map((u) => u.activity).join(" and ")} outfits.`;
  return unlocks.length ? "Adds variety to outfits you can already make." : "You don't own what it goes with yet.";
}

/** "Should I buy this?": a shop photo checked against the closet. Nothing is stored unless the user taps "I bought it". */
export function FittingRoom({ weather }: { weather: Weather }) {
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setStep({ kind: "working" });
    try {
      const { photo, checked } = await check(file);
      setStep({ kind: "result", photo, checked });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Couldn't check that item. Try again.");
      setStep({ kind: "pick" });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (step.kind === "bought") return <AddGarment weather={weather} initialFile={step.photo} />;

  return (
    <div className="flex flex-col gap-5">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {step.kind === "pick" && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-10 text-center hover:bg-muted">
          <span className="text-base font-medium">Choose a photo of the item</span>
          <span className="text-sm text-muted-foreground">A shop photo or a screenshot works. It isn&apos;t saved and doesn&apos;t go into your catalog.</span>
          <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      )}
      {step.kind === "working" && <p className="py-10 text-center text-muted-foreground" aria-live="polite">Checking it against your closet…</p>}
      {step.kind === "result" && (
        <Verdict step={step} weather={weather} onBought={() => setStep({ kind: "bought", photo: step.photo })} onAgain={() => setStep({ kind: "pick" })} />
      )}
    </div>
  );
}

type VerdictProps = { step: Extract<Step, { kind: "result" }>; weather: Weather; onBought: () => void; onAgain: () => void };

/** An object URL for the photo, made while shown and revoked when hidden (also when Next keeps the page hidden in the background). */
function usePhotoUrl(photo: File): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(photo);
    setUrl(u); // eslint-disable-line react-hooks/set-state-in-effect -- the URL is an external resource tied to this effect
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  return url;
}

function Verdict({ step: { photo, checked }, weather, onBought, onAgain }: VerdictProps) {
  const photoUrl = usePhotoUrl(photo);
  const [activity, setActivity] = useState<string | null>(null);
  const [examples, setExamples] = useState<ExampleResult | null>(null);
  const [pending, startTransition] = useTransition();

  function show(a: string) {
    setActivity(a);
    setExamples(null);
    startTransition(async () => {
      try {
        setExamples(await exampleOutfits(checked.tags, a, weather, localToday()));
      } catch (e) {
        console.error(e);
        setExamples({ ok: false, error: "Couldn't reach Ownfit. Check your connection and try again." });
      }
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
        <img src={photoUrl} alt="" className="aspect-square w-28 shrink-0 rounded-lg border bg-white object-contain" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">{checked.tags.name}</p>
          <p className="text-sm">{headline(checked)}</p>
          {checked.similar > 0 && checked.verdict !== "duplicate" && (
            <p className="text-xs text-muted-foreground">You have {checked.similar} {checked.tags.subcategory.replace(/-/g, " ")} in other colors.</p>
          )}
        </div>
      </div>
      {!checked.unlocks.length && checked.verdict === "duplicate" && <p className="text-sm text-muted-foreground">It wouldn&apos;t complete any outfit with what you own yet.</p>}
      {checked.notGarment && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">This doesn&apos;t look like clothing. Check the photo.</p>}

      {checked.unlocks.length > 0 && (
        <ul className="flex flex-col gap-2">
          {checked.unlocks.map((u) => (
            <li key={u.activity} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm"><span className="font-medium capitalize">{u.activity}</span>: {u.outfits} {u.outfits === 1 ? "outfit" : "outfits"}</span>
              <Button size="sm" variant={activity === u.activity ? "default" : "outline"} disabled={pending} onClick={() => show(u.activity)}>See examples</Button>
            </li>
          ))}
        </ul>
      )}
      {pending && <p className="text-muted-foreground" aria-live="polite">Putting outfits together…</p>}
      {examples && !examples.ok && <p role="alert" className="text-sm text-red-700">{examples.error}</p>}
      {examples?.ok && examples.outfits.map((o, i) => <Example key={i} outfit={o} photoUrl={photoUrl} />)}

      <div className="flex gap-2">
        <Button className="flex-1" onClick={onBought}>I bought it</Button>
        <Button variant="outline" className="flex-1" onClick={onAgain}>Check another</Button>
      </div>
    </section>
  );
}

/** A read-only outfit: feedback and swaps are for things you own. */
function Example({ outfit, photoUrl }: { outfit: Outfit; photoUrl: string }) {
  return (
    <article className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="grid grid-cols-3 gap-2">
        {outfit.pieces.map((p) => (
          <figure key={p.id} className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed R2 URL or local object URL */}
            <img src={p.imageUrl || photoUrl} alt="" className="aspect-square w-full rounded-md border bg-white object-contain" />
            <figcaption className="truncate text-xs text-muted-foreground">{p.imageUrl ? p.name : `${p.name} (new)`}</figcaption>
          </figure>
        ))}
      </div>
      <p className="text-sm">{outfit.why}</p>
    </article>
  );
}
