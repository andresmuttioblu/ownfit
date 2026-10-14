"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
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
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Add up to {max} outfit photos you&apos;ve saved (screenshots from Pinterest or Instagram are fine). They&apos;re read for style, then discarded; they aren&apos;t stored.
      </p>
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((r, i) => (
            <div key={r.previewUrl} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img src={r.previewUrl} alt={`Reference ${i + 1}`} className="aspect-[3/4] w-full rounded-md object-cover" />
              <button type="button" onClick={() => remove(i)} disabled={busy} aria-label={`Remove reference ${i + 1}`}
                className="absolute right-1 top-1 rounded-full bg-background/90 px-2 text-sm">×</button>
            </div>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {value.length < max && (
        <label className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-sm font-medium hover:bg-muted ${busy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
          {busy ? "Reading…" : "Add images"}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={busy}
            onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}
