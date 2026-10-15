"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronRight, CircleCheck, ImagePlus, MousePointerClick, Plus } from "lucide-react";
import { CameraShirt } from "@/components/illustrations";
import { GarmentImage } from "@/components/garment-tile";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { TagFields } from "@/app/catalog/tag-fields";
import type { Cutout } from "@/lib/catalog/cutout";
import type { GarmentTags } from "@/lib/catalog/vocabulary";
import { confirmDraft, discardDraft } from "./actions";
import { TapSelect } from "./tap-select";
import { Unlocks } from "./unlocks";
import { PhotoDrop, ROW, rowTone, useObjectUrl, Wait } from "./ui";
import type { Unlock, Weather } from "@/lib/outfits/filter";

const EMPTY_TAGS: GarmentTags = {
  name: "", category: "top", subcategory: "other", colors: [], pattern: "solid", material: "other",
  formality: 2, warmth: 3, seasons: [], tags: [],
};

type Draft = { draftId: string; imageUrl: string; tags: GarmentTags; warnings: string[] };
/** A photo being worked on, kept in the browser until it is uploaded. Object URLs are made where it's shown (useObjectUrl). */
type Shot = { photo: HTMLCanvasElement; original: Blob; cutout: Cutout };
type Step =
  | { kind: "pick" }
  | { kind: "working"; message: string }
  | { kind: "check"; shot: Shot }
  | { kind: "tap"; shot: Shot }
  | { kind: "confirm"; draft: Draft }
  | { kind: "saved"; name: string; category: string; garmentId: string; unlocks: Unlock[] };

async function makeShot(file: File): Promise<Shot> {
  const { autoMask, loadPhoto, onWhite, preloadTapModels, toBlob } = await import("@/lib/catalog/cutout"); // browser-only (onnxruntime-web)
  const photo = await loadPhoto(file);
  preloadTapModels();
  const cutout = await onWhite(photo, await autoMask(photo));
  const original = await toBlob(photo, "image/jpeg", 0.85);
  return { photo, original, cutout };
}

/** Done with a shot for good (retaken or uploaded). Not on unmount: Next may only be hiding the page and bring it back. */
function release(shot: Shot) {
  shot.photo.width = shot.photo.height = 0; // iOS Safari frees canvas memory late
}

function CutoutImage({ blob }: { blob: Blob }) {
  const url = useObjectUrl(blob);
  return url ? <GarmentImage src={url} alt="Cutout of your item" className="rounded-2xl" /> : <div className="aspect-square w-full rounded-2xl bg-tile" />;
}

async function createDraft({ original, cutout }: Shot): Promise<Draft> {
  const form = new FormData();
  form.set("clean", cutout.clean, "clean.png");
  form.set("original", original, "original.jpg");
  const res = await fetch("/api/garments/draft", { method: "POST", body: form });
  if (res.status === 413) throw new Error("That photo is too large. Try a smaller one.");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Upload failed. Try again.");
  const warnings = [
    cutout.isBlank && "The cutout looks almost empty. A plainer background or more light usually helps.",
    body.notGarment && "This doesn't look like clothing. Check the photo before adding it.",
    body.tagError,
  ].filter(Boolean) as string[];
  return { draftId: body.draftId, imageUrl: body.imageUrl, tags: body.tags ?? EMPTY_TAGS, warnings };
}

/** initialFile: start from this photo right away (an item bought from the fitting room). */
export function AddGarment({ weather, initialFile }: { weather: Weather; initialFile?: File }) {
  const [step, setStep] = useState<Step>(initialFile ? { kind: "working", message: "Removing the background…" } : { kind: "pick" });
  const [tags, setTags] = useState<GarmentTags>(EMPTY_TAGS);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { // download the model while the user frames the photo
    import("@/lib/catalog/cutout").then((m) => m.preloadCutoutModel()).catch(console.error);
  }, []);

  function fail(e: unknown) {
    console.error(e);
    setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    setStep({ kind: "pick" });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setStep({ kind: "working", message: "Removing the background…" });
    try {
      setStep({ kind: "check", shot: await makeShot(file) });
    } catch (e) {
      fail(e);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const started = useRef(false);
  useEffect(() => {
    if (!initialFile || started.current) return; // once, even under Strict Mode's double effects
    started.current = true;
    makeShot(initialFile).then((shot) => setStep({ kind: "check", shot }), fail);
  }, [initialFile]);

  function retake(shot: Shot) {
    release(shot);
    setError(null);
    setStep({ kind: "pick" });
  }

  function acceptTapCutout(shot: Shot, cutout: Cutout) {
    setStep({ kind: "check", shot: { ...shot, cutout } });
  }

  async function upload(shot: Shot) {
    setStep({ kind: "working", message: "Tagging…" });
    try {
      const draft = await createDraft(shot);
      release(shot);
      setTags(draft.tags);
      setStep({ kind: "confirm", draft });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
      setStep({ kind: "check", shot }); // keep the photo so the user can retry
      console.error(e);
    }
  }

  function confirm(draft: Draft) {
    setError(null);
    startTransition(async () => {
      const result = await confirmDraft(draft.draftId, tags);
      if (result.ok) setStep({ kind: "saved", name: tags.name, category: tags.category, garmentId: result.garmentId, unlocks: result.unlocks });
      else setError(result.error);
    });
  }

  function cancel(draft: Draft) {
    setError(null);
    startTransition(async () => {
      await discardDraft(draft.draftId);
      setStep({ kind: "pick" });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error && step.kind !== "confirm" && step.kind !== "check" && <Notice tone="error">{error}</Notice>}

      {step.kind === "pick" && (
        <PhotoDrop illustration={<CameraShirt className="h-24" />} title="Take or choose a photo" inputRef={inputRef} onFile={onFile}
          hint="One item, hanging or laid flat, in good light. Keep people and other things out of the frame." />
      )}

      {step.kind === "working" && <Wait>{step.message}</Wait>}

      {step.kind === "check" && (
        <>
          <div className="rise-in flex flex-col items-center gap-3 rounded-3xl bg-muted p-2">
            <CutoutImage blob={step.shot.cutout.clean} />
          </div>
          <h2 className="-mb-2 text-center text-lg font-semibold">Is that just the item?</h2>
          {step.shot.cutout.isBlank && <Notice tone="warning">The cutout looks almost empty. Tap the item to select it.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex flex-col gap-2">
            <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => upload(step.shot)}><Check aria-hidden />Looks good</Button>
            <button type="button" className={`${ROW} ${rowTone(false)}`} onClick={() => { setError(null); setStep({ kind: "tap", shot: step.shot }); }}>
              <MousePointerClick className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex-1 text-base font-medium">Tap the item instead</span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
            </button>
            <Button variant="ghost" size="lg" className="text-muted-foreground" onClick={() => retake(step.shot)}><ImagePlus aria-hidden />Choose another photo</Button>
          </div>
        </>
      )}

      {step.kind === "tap" && (
        <TapSelect photo={step.shot.photo} original={step.shot.original}
          onDone={(cutout) => acceptTapCutout(step.shot, cutout)}
          onCancel={() => setStep({ kind: "check", shot: step.shot })} />
      )}

      {step.kind === "confirm" && (
        <>
          <div className="rise-in rounded-3xl bg-muted p-2">
            <GarmentImage src={step.draft.imageUrl} alt="Cutout of your item" className="rounded-2xl" />
          </div>
          {step.draft.warnings.map((w) => <Notice key={w} tone="warning">{w}</Notice>)}
          <TagFields value={(k) => tags[k]} set={(p) => setTags((t) => ({ ...t, ...p }))} single />
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex flex-col gap-2">
            <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => confirm(step.draft)} disabled={pending}>{pending ? "Adding…" : "Add to catalog"}</Button>
            <Button variant="ghost" size="lg" className="text-muted-foreground" onClick={() => cancel(step.draft)} disabled={pending}>Discard</Button>
          </div>
        </>
      )}

      {step.kind === "saved" && (
        <div className="rise-in flex flex-col items-center gap-5 py-4 text-center">
          <CircleCheck className="size-10" strokeWidth={1.5} aria-hidden />
          <p className="text-lg font-semibold text-balance">Added {step.name || "your item"}.</p>
          <Unlocks garmentId={step.garmentId} category={step.category} unlocks={step.unlocks} weather={weather} />
          <div className="flex w-full flex-col gap-2">
            <Button size="lg" className="h-14 rounded-2xl text-base" onClick={() => setStep({ kind: "pick" })}><Plus aria-hidden />Add another</Button>
            <Button variant="ghost" size="lg" className="text-muted-foreground" nativeButton={false} render={<Link href="/catalog" />}>Open catalog</Button>
          </div>
        </div>
      )}
    </div>
  );
}
