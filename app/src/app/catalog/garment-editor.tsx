"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Notice } from "@/components/notice";
import { GarmentImage } from "@/components/garment-tile";
import { TagFields } from "./tag-fields";
import { updateGarments, type GarmentPatch } from "./actions";
import type { CatalogItem } from "./catalog-review";

function shared<K extends keyof CatalogItem>(items: CatalogItem[], key: K): CatalogItem[K] | undefined {
  const first = JSON.stringify(items[0][key]);
  return items.every((i) => JSON.stringify(i[key]) === first) ? items[0][key] : undefined;
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
          <SheetDescription>{isBulk ? "Only the fields you change are applied to every selected item." : "Fix anything that looks off."}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-4">
          {!isBulk && <GarmentImage src={items[0].imageUrl} alt={items[0].name} className="mx-auto w-48" />}
          <TagFields value={value} set={set} single={!isBulk} />
          {error && <Notice tone="error">{error}</Notice>}
        </div>
        <SheetFooter>
          <Button size="lg" onClick={save} disabled={pending}><Check aria-hidden />{pending ? "Saving…" : "Save & mark reviewed"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
