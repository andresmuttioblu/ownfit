"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TagFields } from "@/app/catalog/tag-fields";
import type { Cutout } from "@/lib/catalog/cutout";
import type { GarmentTags } from "@/lib/catalog/vocabulary";
import { confirmDraft, discardDraft } from "./actions";
import { TapSelect } from "./tap-select";

const EMPTY_TAGS: GarmentTags = {
  name: "", category: "top", subcategory: "other", colors: [], pattern: "solid", material: "other",
  formality: 2, warmth: 3, seasons: [], tags: [],
};

type Draft = { draftId: string; imageUrl: string; tags: GarmentTags; warnings: string[] };
/** A photo being worked on, kept in the browser until it is uploaded. */
type Shot = { photo: HTMLCanvasElement; original: Blob; photoUrl: string; cutout: Cutout; cutoutUrl: string };
type Step =
  | { kind: "pick" }
  | { kind: "working"; message: string }
  | { kind: "check"; shot: Shot }
  | { kind: "tap"; shot: Shot }
  | { kind: "confirm"; draft: Draft }
  | { kind: "saved"; name: string };

async function makeShot(file: File): Promise<Shot> {
  const { autoMask, loadPhoto, onWhite, preloadTapModels, toBlob } = await import("@/lib/catalog/cutout"); // browser-only (onnxruntime-web)
  const photo = await loadPhoto(file);
  preloadTapModels();
  const cutout = await onWhite(photo, await autoMask(photo));
  const original = await toBlob(photo, "image/jpeg", 0.85);
  return { photo, original, photoUrl: URL.createObjectURL(original), cutout, cutoutUrl: URL.createObjectURL(cutout.clean) };
}

function release(shot: Shot) {
  URL.revokeObjectURL(shot.photoUrl);
  URL.revokeObjectURL(shot.cutoutUrl);
  shot.photo.width = shot.photo.height = 0; // iOS Safari frees canvas memory late
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

export function AddGarment() {
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [tags, setTags] = useState<GarmentTags>(EMPTY_TAGS);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { // download the model while the user frames the photo
    import("@/lib/catalog/cutout").then((m) => m.preloadCutoutModel()).catch(console.error);
  }, []);

  const shown = useRef<Shot | null>(null); // the shot on screen, released if the user leaves mid-flow
  useEffect(() => { shown.current = step.kind === "check" || step.kind === "tap" ? step.shot : null; }, [step]);
  useEffect(() => () => { if (shown.current) release(shown.current); }, []);

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

  function retake(shot: Shot) {
    release(shot);
    setError(null);
    setStep({ kind: "pick" });
  }

  function acceptTapCutout(shot: Shot, cutout: Cutout) {
    URL.revokeObjectURL(shot.cutoutUrl);
    setStep({ kind: "check", shot: { ...shot, cutout, cutoutUrl: URL.createObjectURL(cutout.clean) } });
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
      if (result.ok) setStep({ kind: "saved", name: tags.name });
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
    <div className="flex flex-col gap-5">
      {error && step.kind !== "confirm" && step.kind !== "check" && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {step.kind === "pick" && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-10 text-center hover:bg-muted">
          <span className="text-base font-medium">Take or choose a photo</span>
          <span className="text-sm text-muted-foreground">One item, hanging or laid flat, in good light. Keep people and other things out of the frame.</span>
          <input ref={inputRef} type="file" accept="image/*" className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      )}

      {step.kind === "working" && <p className="py-10 text-center text-muted-foreground" aria-live="polite">{step.message}</p>}

      {step.kind === "check" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img src={step.shot.cutoutUrl} alt="Cutout of your item" className="mx-auto aspect-square w-56 rounded-lg border bg-white object-contain" />
          <p className="text-center text-sm text-muted-foreground">Is that just the item?</p>
          {step.shot.cutout.isBlank && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">The cutout looks almost empty. Tap the item to select it.</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button className="flex-1" onClick={() => upload(step.shot)}>Looks good</Button>
            <Button variant="outline" className="flex-1" onClick={() => { setError(null); setStep({ kind: "tap", shot: step.shot }); }}>Tap the item instead</Button>
          </div>
          <Button variant="ghost" onClick={() => retake(step.shot)}>Choose another photo</Button>
        </>
      )}

      {step.kind === "tap" && (
        <TapSelect photo={step.shot.photo} photoUrl={step.shot.photoUrl}
          onDone={(cutout) => acceptTapCutout(step.shot, cutout)}
          onCancel={() => setStep({ kind: "check", shot: step.shot })} />
      )}

      {step.kind === "confirm" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL */}
          <img src={step.draft.imageUrl} alt="Cutout of your item" className="mx-auto aspect-square w-56 rounded-lg border bg-white object-contain" />
          {step.draft.warnings.map((w) => <p key={w} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{w}</p>)}
          <TagFields value={(k) => tags[k]} set={(p) => setTags((t) => ({ ...t, ...p }))} single />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => confirm(step.draft)} disabled={pending}>{pending ? "Adding…" : "Add to catalog"}</Button>
            <Button variant="outline" onClick={() => cancel(step.draft)} disabled={pending}>Discard</Button>
          </div>
        </>
      )}

      {step.kind === "saved" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-lg font-medium">Added {step.name || "your item"}.</p>
          <div className="flex gap-2">
            <Button onClick={() => setStep({ kind: "pick" })}>Add another</Button>
            <Button variant="outline" render={<Link href="/catalog" />}>Open catalog</Button>
          </div>
        </div>
      )}
    </div>
  );
}
