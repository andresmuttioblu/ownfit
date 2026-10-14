"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TagFields } from "@/app/catalog/tag-fields";
import type { GarmentTags } from "@/lib/catalog/vocabulary";
import { confirmDraft, discardDraft } from "./actions";

const EMPTY_TAGS: GarmentTags = {
  name: "", category: "top", subcategory: "other", colors: [], pattern: "solid", material: "other",
  formality: 2, warmth: 3, seasons: [], tags: [],
};

type Draft = { draftId: string; imageUrl: string; tags: GarmentTags; warnings: string[] };
type Step = { kind: "pick" } | { kind: "working"; message: string } | { kind: "confirm"; draft: Draft } | { kind: "saved"; name: string };

async function createDraft(file: File, onProgress: (m: string) => void): Promise<Draft> {
  onProgress("Removing the background…");
  const { cutOut } = await import("@/lib/catalog/cutout"); // browser-only (onnxruntime-web)
  const { clean, original, isBlank } = await cutOut(file);
  onProgress("Tagging…");
  const form = new FormData();
  form.set("clean", clean, "clean.png");
  form.set("original", original, "original.jpg");
  const res = await fetch("/api/garments/draft", { method: "POST", body: form });
  if (res.status === 413) throw new Error("That photo is too large. Try a smaller one.");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Upload failed. Try again.");
  const warnings = [
    isBlank && "The cutout looks almost empty. A plainer background or more light usually helps.",
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

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setStep({ kind: "working", message: "Preparing…" });
    try {
      const draft = await createDraft(file, (message) => setStep({ kind: "working", message }));
      setTags(draft.tags);
      setStep({ kind: "confirm", draft });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setStep({ kind: "pick" });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
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
      {error && step.kind !== "confirm" && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {step.kind === "pick" && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-10 text-center hover:bg-muted">
          <span className="text-base font-medium">Take or choose a photo</span>
          <span className="text-sm text-muted-foreground">One item, hanging or laid flat, in good light. Keep people and other things out of the frame.</span>
          <input ref={inputRef} type="file" accept="image/*" className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      )}

      {step.kind === "working" && <p className="py-10 text-center text-muted-foreground" aria-live="polite">{step.message}</p>}

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
