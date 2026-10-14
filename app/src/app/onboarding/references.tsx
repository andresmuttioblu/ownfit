"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Notice } from "@/components/notice";
import { STYLE_VOCAB, type StyleWeights } from "@/lib/style/profile";

const MAX_SIDE = 1024;

export type Reference = { previewUrl: string; weights: StyleWeights };

async function readReference(file: File): Promise<Reference> {
  const { loadPhoto, toBlob } = await import("@/lib/image");
  const photo = await loadPhoto(file, MAX_SIDE);
  const jpeg = await toBlob(photo, "image/jpeg", 0.85);
  photo.width = photo.height = 0;
  const form = new FormData();
  form.set("image", jpeg, "reference.jpg");
  const res = await fetch("/api/style/reference", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "That image couldn't be read. Try another one.");
  if (body.noOutfit) throw new Error("That image doesn't seem to show an outfit, so it was skipped.");
  return { previewUrl: URL.createObjectURL(jpeg), weights: body.weights };
}

/** Optional: images the user saved themselves (no links, no scraping), read the same way as the presets. */
export function References({ value, onChange, busy, setBusy }: {
  value: Reference[];
  onChange: Dispatch<SetStateAction<Reference[]>>; // functional updates: a read can finish after a removal
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const max = STYLE_VOCAB.limits.references;

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    for (const file of [...files].slice(0, max - value.length)) {
      try {
        const ref = await readReference(file);
        onChange((prev) => (prev.length < max ? [...prev, ref] : prev));
      } catch (e) {
        setError(e instanceof Error ? e.message : "That image couldn't be read.");
      }
    }
    setBusy(false);
  }

  function remove(i: number) {
    URL.revokeObjectURL(value[i].previewUrl);
    onChange((prev) => prev.filter((r) => r !== value[i]));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-pretty text-muted-foreground">
        Add up to {max} outfit photos you&apos;ve saved (screenshots from Pinterest or Instagram are fine). They&apos;re read for style, then discarded, never stored.
      </p>
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((r, i) => (
            <div key={r.previewUrl} className="rise-in relative" style={{ "--i": i } as React.CSSProperties}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img src={r.previewUrl} alt={`Reference ${i + 1}`} className="aspect-[3/4] w-full rounded-xl object-cover" />
              <button type="button" onClick={() => remove(i)} disabled={busy} aria-label={`Remove reference ${i + 1}`}
                className="group absolute top-0 right-0 flex size-11 items-start justify-end p-1.5 outline-none disabled:opacity-50">
                <span className="flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground transition-transform duration-150 group-focus-visible:ring-2 group-focus-visible:ring-ring group-active:scale-90">
                  <X className="size-3.5" aria-hidden />
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {value.length < max && (
        <label className={`flex h-16 items-center gap-3.5 rounded-2xl border border-dashed px-4 text-muted-foreground transition-[color,transform] duration-150 focus-within:ring-2 focus-within:ring-ring active:scale-[0.99] ${busy ? "pointer-events-none opacity-60" : "cursor-pointer hover:text-foreground"}`}>
          {busy ? <Loader2 className="size-5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden /> : <ImagePlus className="size-5 shrink-0" aria-hidden />}
          <span className="text-base font-medium">{busy ? "Reading…" : value.length ? "Add more photos" : "Add photos"}</span>
          <input type="file" accept="image/*" multiple className="sr-only" disabled={busy}
            onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}
