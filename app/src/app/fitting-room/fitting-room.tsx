"use client";

import { useRef, useState, useTransition, type CSSProperties } from "react";
import { Copy, Layers, ShoppingBag, Sparkles, Unlink } from "lucide-react";
import { QuestionTag, SwingingHanger } from "@/components/illustrations";
import { FlatLay } from "@/components/flat-lay";
import { GarmentImage } from "@/components/garment-tile";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { AddGarment } from "@/app/add/add-garment";
import type { Outfit } from "@/app/_today/actions";
import { localToday } from "@/app/_today/outfit-card";
import type { GarmentTags } from "@/lib/catalog/vocabulary";
import type { Weather } from "@/lib/outfits/filter";
import type { Assessment } from "@/lib/outfits/fitting";
import { PhotoDrop, UnlockRows, useObjectUrl, Wait } from "@/app/add/ui";
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

function VerdictIcon({ verdict, unlocks }: Checked) {
  const Icon = verdict === "duplicate" ? Copy : verdict === "gap" ? Sparkles : unlocks.length ? Layers : Unlink;
  return <Icon className="size-5" aria-hidden />;
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
    <div className="flex flex-col gap-6">
      {error && <Notice tone="error">{error}</Notice>}
      {step.kind === "pick" && (
        <PhotoDrop illustration={<QuestionTag className="h-24" />} title="Choose a photo of the item" inputRef={inputRef} onFile={onFile}
          hint="A shop photo or a screenshot works. It isn't saved and doesn't go into your catalog." />
      )}
      {step.kind === "working" && <Wait>Checking it against your closet…</Wait>}
      {step.kind === "result" && (
        <Verdict step={step} weather={weather} onBought={() => setStep({ kind: "bought", photo: step.photo })} onAgain={() => setStep({ kind: "pick" })} />
      )}
    </div>
  );
}

type VerdictProps = { step: Extract<Step, { kind: "result" }>; weather: Weather; onBought: () => void; onAgain: () => void };

function Verdict({ step: { photo, checked }, weather, onBought, onAgain }: VerdictProps) {
  const photoUrl = useObjectUrl(photo);
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
    <section className="flex flex-col gap-6">
      <div className="rise-in flex flex-col gap-4">
        <div className="mx-auto w-48 rounded-3xl bg-muted p-2">
          <GarmentImage src={photoUrl} alt={checked.tags.name} className="rounded-2xl" />
        </div>
        <div className="flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><VerdictIcon {...checked} /></span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-lg leading-snug font-semibold text-balance">{headline(checked)}</h2>
            <p className="text-sm text-muted-foreground">{checked.tags.name}</p>
            {checked.similar > 0 && checked.verdict !== "duplicate" && (
              <p className="text-sm text-muted-foreground">You have {checked.similar} {checked.tags.subcategory.replace(/-/g, " ")} in other colors.</p>
            )}
          </div>
        </div>
      </div>
      {!checked.unlocks.length && checked.verdict === "duplicate" && <p className="text-sm text-muted-foreground">It wouldn&apos;t complete any outfit with what you own yet.</p>}
      {checked.notGarment && <Notice tone="warning">This doesn&apos;t look like clothing. Check the photo.</Notice>}

      {checked.unlocks.length > 0 && <UnlockRows unlocks={checked.unlocks} active={activity} disabled={pending} onPick={show} />}
      {pending && (
        <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground" aria-live="polite">
          <SwingingHanger className="h-14" />
          <p className="text-sm">Putting outfits together…</p>
        </div>
      )}
      {examples && !examples.ok && <Notice tone="error">{examples.error}</Notice>}
      {examples?.ok && examples.outfits.map((o, i) => <Example key={i} index={i} outfit={o} photoUrl={photoUrl} />)}

      <div className="flex flex-col gap-2">
        <Button size="lg" className="h-14 rounded-2xl text-base" onClick={onBought}><ShoppingBag aria-hidden />I bought it</Button>
        <Button variant="ghost" size="lg" className="text-muted-foreground" onClick={onAgain}>Check another</Button>
      </div>
    </section>
  );
}

/** A read-only outfit: feedback and swaps are for things you own. The new piece shows the shop photo. */
function Example({ outfit, photoUrl, index }: { outfit: Outfit; photoUrl: string; index: number }) {
  return (
    <article className="rise-in flex flex-col gap-3" style={{ "--i": index } as CSSProperties}>
      <div className="rounded-3xl bg-muted p-2">
        <FlatLay pieces={outfit.pieces} tile={(p) => <GarmentImage src={p.imageUrl || photoUrl} alt={p.imageUrl ? p.name : `${p.name} (new)`} className="rounded-2xl" />} />
      </div>
      <p className="px-1 text-[0.9375rem] leading-snug text-pretty">{outfit.why}</p>
    </article>
  );
}
