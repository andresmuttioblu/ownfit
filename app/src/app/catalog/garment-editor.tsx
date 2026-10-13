"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CATEGORIES, VOCAB, type Category } from "@/lib/catalog/vocabulary";
import { updateGarments, type GarmentPatch } from "./actions";
import type { CatalogItem } from "./catalog-review";

const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50";

function shared<K extends keyof CatalogItem>(items: CatalogItem[], key: K): CatalogItem[K] | undefined {
  const first = JSON.stringify(items[0][key]);
  return items.every((i) => JSON.stringify(i[key]) === first) ? items[0][key] : undefined;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Chips({ options, value, onChange, max }: { options: string[]; value: string[] | undefined; onChange: (v: string[]) => void; max?: number }) {
  const current = value ?? [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = current.includes(o);
        return (
          <button key={o} type="button" aria-pressed={on}
            onClick={() => onChange(on ? current.filter((c) => c !== o) : max && current.length >= max ? current : [...current, o])}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? "border-foreground bg-foreground text-background" : "hover:bg-muted"}`}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Scale({ value, onChange, labels }: { value: number | undefined; onChange: (v: number) => void; labels: Record<string, string> }) {
  return (
    <div className="flex gap-1.5" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} title={labels[n]} onClick={() => onChange(n)}
          className={`size-9 rounded-md border text-sm ${value === n ? "border-foreground bg-foreground text-background" : "hover:bg-muted"}`}>
          {n}
        </button>
      ))}
      <span className="self-center pl-1 text-xs text-muted-foreground">{value ? labels[value] : "mixed"}</span>
    </div>
  );
}

/** Edits one garment, or several at once (only the fields you touch are changed). */
export function GarmentEditor({ items, open, onOpenChange }: { items: CatalogItem[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [patch, setPatch] = useState<GarmentPatch>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (items.length === 0) return null;

  const isBulk = items.length > 1;
  const value = <K extends keyof GarmentPatch & keyof CatalogItem>(k: K) => (k in patch ? patch[k] : shared(items, k)) as GarmentPatch[K];
  const set = (p: GarmentPatch) => setPatch((prev) => ({ ...prev, ...p }));
  const category = value("category") as Category | undefined;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateGarments(items.map((i) => i.id), { ...patch, needsReview: false });
      if (result.ok) {
        setPatch({});
        onOpenChange(false);
      } else setError(result.error);
    });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { setPatch({}); setError(null); } onOpenChange(o); }}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isBulk ? `Edit ${items.length} items` : items[0].name}</SheetTitle>
          <SheetDescription>{isBulk ? "Only the fields you change are applied to every selected item." : "Fix anything the tagging got wrong."}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4">
          {!isBulk && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL */}
              <img src={items[0].imageUrl} alt={items[0].name} className="mx-auto aspect-square w-48 rounded-md border object-contain" />
              <Field label="Name">
                <Input value={(value("name") as string) ?? ""} maxLength={VOCAB.limits.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select className={selectClass} value={category ?? ""} onChange={(e) => set({ category: e.target.value, subcategory: "other" })}>
                {!category && <option value="">mixed</option>}
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select className={selectClass} disabled={!category} value={(value("subcategory") as string) ?? ""} onChange={(e) => set({ category, subcategory: e.target.value })}>
                {!value("subcategory") && <option value="">mixed</option>}
                {category && VOCAB.categories[category].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Pattern">
              <select className={selectClass} value={(value("pattern") as string) ?? ""} onChange={(e) => set({ pattern: e.target.value })}>
                {!value("pattern") && <option value="">mixed</option>}
                {VOCAB.patterns.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Material">
              <select className={selectClass} value={(value("material") as string) ?? ""} onChange={(e) => set({ material: e.target.value })}>
                {!value("material") && <option value="">mixed</option>}
                {VOCAB.materials.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
          </div>
          <Field label={`Colors (up to ${VOCAB.limits.colors}, main first)`}>
            <Chips options={VOCAB.colors} value={value("colors") as string[] | undefined} max={VOCAB.limits.colors} onChange={(colors) => set({ colors })} />
          </Field>
          <Field label="Seasons">
            <Chips options={VOCAB.seasons} value={value("seasons") as string[] | undefined} onChange={(seasons) => set({ seasons })} />
          </Field>
          <Field label="Formality">
            <Scale value={value("formality") as number | undefined} labels={VOCAB.formality} onChange={(formality) => set({ formality })} />
          </Field>
          <Field label="Warmth">
            <Scale value={value("warmth") as number | undefined} labels={VOCAB.warmth} onChange={(warmth) => set({ warmth })} />
          </Field>
          {!isBulk && (
            <Field label="Tags (comma separated)">
              <Input defaultValue={items[0].tags.join(", ")}
                onChange={(e) => set({ tags: e.target.value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) })} />
            </Field>
          )}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
        <SheetFooter>
          <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save & mark reviewed"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
