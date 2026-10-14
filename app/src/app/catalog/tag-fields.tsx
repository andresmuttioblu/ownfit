"use client";

import { Input } from "@/components/ui/input";
import { CATEGORIES, VOCAB, type Category, type GarmentTags } from "@/lib/catalog/vocabulary";

const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function Chips({ options, value, onChange, max }: { options: string[]; value: string[] | undefined; onChange: (v: string[]) => void; max?: number }) {
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

/** The tag form shared by the catalog editor (single and bulk) and the add screen.
 * value(k) returns undefined for "mixed" (bulk edit with differing values). */
export function TagFields({ value, set, single }: {
  value: <K extends keyof GarmentTags>(k: K) => GarmentTags[K] | undefined;
  set: (patch: Partial<GarmentTags>) => void;
  single: boolean;
}) {
  const category = value("category") as Category | undefined;
  return (
    <>
          {single && (
            <>
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
          {single && (
            <Field label="Tags (comma separated)">
              <Input defaultValue={(value("tags") ?? []).join(", ")}
                onChange={(e) => set({ tags: e.target.value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) })} />
            </Field>
          )}
    </>
  );
}
