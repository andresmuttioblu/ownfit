"use client";

import { Chips, Field } from "@/app/catalog/tag-fields";
import VOCAB from "@/lib/catalog/garment-tags.json";
import { COLOR_SEASONS, MAX_AVOID, MAX_SUITS, UNDERTONES, type Coloring } from "@/lib/style/coloring";

export const NO_COLORING: Coloring = { undertone: "not sure", season: null, suits: [], avoid: [] };

/** One choice from a short list; tapping the picked one again clears it when clearable. */
function OneOf<T extends string>({ options, value, onChange, clearable }: {
  options: readonly T[]; value: T | null; onChange: (v: T | null) => void; clearable?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o;
        return (
          <button key={o} type="button" aria-pressed={on} onClick={() => onChange(on && clearable ? null : o)}
            className={`h-11 rounded-full px-4 text-sm capitalize transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** Self-reported colors that suit the person. Everything is optional; nothing is read from a photo. */
export function ColorsStep({ value, onChange }: { value: Coloring; onChange: (c: Coloring) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-pretty text-muted-foreground">
        If you know what suits you, outfits will keep those colors near your face. Skip anything you&apos;re unsure of.
      </p>
      <Field label="Skin undertone">
        <OneOf options={UNDERTONES} value={value.undertone} onChange={(undertone) => onChange({ ...value, undertone: undertone ?? "not sure" })} />
      </Field>
      <Field label="Color season, if you've had an analysis">
        <OneOf options={COLOR_SEASONS} value={value.season} clearable onChange={(season) => onChange({ ...value, season })} />
      </Field>
      <Field label={`Colors that suit you (up to ${MAX_SUITS})`}>
        <Chips options={VOCAB.colors.filter((c) => !value.avoid.includes(c))} value={value.suits} max={MAX_SUITS}
          onChange={(suits) => onChange({ ...value, suits })} />
      </Field>
      <Field label={`Colors to keep away from your face (up to ${MAX_AVOID})`}>
        <Chips options={VOCAB.colors.filter((c) => !value.suits.includes(c))} value={value.avoid} max={MAX_AVOID}
          onChange={(avoid) => onChange({ ...value, avoid })} />
      </Field>
    </div>
  );
}
