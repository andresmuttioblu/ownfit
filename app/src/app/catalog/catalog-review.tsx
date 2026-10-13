"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CATEGORIES } from "@/lib/catalog/vocabulary";
import { deleteGarments, mergeGarments, updateGarments, type ActionResult } from "./actions";
import { GarmentEditor } from "./garment-editor";

export type CatalogItem = {
  id: string; name: string; category: string; subcategory: string; colors: string[]; pattern: string;
  material: string; formality: number; warmth: number; seasons: string[]; tags: string[];
  needsReview: boolean; imageUrl: string;
};

type Confirm = { kind: "delete" } | { kind: "merge" } | null;

function gridColumns(grid: HTMLElement | null): number {
  return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 1;
}

export function CatalogReview({ items }: { items: CatalogItem[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState(0);
  const [editing, setEditing] = useState<CatalogItem[]>([]);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const gridRef = useRef<HTMLDivElement>(null);
  const movedByKeyboard = useRef(false);
  const router = useRouter();
  const refreshedForImages = useRef(false);
  // Signed image URLs expire after ~1-2 h; fetch fresh ones once when an image fails.
  const onImageError = useCallback(() => {
    if (refreshedForImages.current) return;
    refreshedForImages.current = true;
    router.refresh();
  }, [router]);

  const reviewCount = items.filter((i) => i.needsReview).length;
  // A category filter whose last item was deleted/recategorised falls back to "all".
  const effectiveFilter = filter === "all" || filter === "review" || items.some((i) => i.category === filter) ? filter : "all";
  const visible = useMemo(() => items.filter((i) =>
    effectiveFilter === "all" || (effectiveFilter === "review" ? i.needsReview : i.category === effectiveFilter)), [items, effectiveFilter]);
  const selectedItems = visible.filter((i) => selected.has(i.id)); // stale ids (deleted/filtered out) are ignored
  const focusIndex = Math.min(focus, Math.max(0, visible.length - 1));

  const toggle = useCallback((id: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);

  function act(fn: () => Promise<ActionResult>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) after?.();
      else setError(result.error);
    });
  }

  const ids = selectedItems.map((i) => i.id);
  const markReviewed = () => act(() => updateGarments(ids, { needsReview: false }), () => setSelected(new Set()));

  // Desktop shortcuts: arrows move, x selects, e/Enter edits, m merges, r marks reviewed, Delete removes, Esc clears.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing.length || confirm || e.metaKey || e.ctrlKey || e.altKey) return; // leave browser shortcuts alone
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (target !== document.body && !gridRef.current?.contains(target)) return; // toolbar buttons, filter, links
      if ((e.target as HTMLElement).closest("input:not([type=checkbox]), select, textarea")) return; // typing, not shortcuts
      const cols = gridColumns(gridRef.current);
      const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      const current = visible[focusIndex];
      if (move !== undefined) {
        e.preventDefault();
        movedByKeyboard.current = true;
        setFocus(Math.min(visible.length - 1, Math.max(0, focusIndex + move)));
      } else if (e.key === "x" && current) toggle(current.id);
      else if (e.key === "e" && current) setEditing(selectedItems.length ? selectedItems : [current]);
      else if (e.key === "m" && selectedItems.length >= 2) setConfirm({ kind: "merge" });
      else if (e.key === "r" && selectedItems.length) markReviewed();
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedItems.length) setConfirm({ kind: "delete" });
      else if (e.key === "Escape") setSelected(new Set());
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!movedByKeyboard.current) return; // don't steal focus on load or after a click
    movedByKeyboard.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-index="${focusIndex}"]`)?.focus();
  }, [focusIndex]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Filter" value={effectiveFilter} onChange={(e) => setFilter(e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="all">All ({items.length})</option>
          <option value="review">Needs review ({reviewCount})</option>
          {CATEGORIES.filter((c) => items.some((i) => i.category === c)).map((c) => (
            <option key={c} value={c}>{c} ({items.filter((i) => i.category === c).length})</option>
          ))}
        </select>
        <p className="hidden text-xs text-muted-foreground lg:block">
          Arrows move · <kbd>x</kbd> select · <kbd>e</kbd> edit · <kbd>m</kbd> merge · <kbd>r</kbd> reviewed · <kbd>Del</kbd> delete · <kbd>Esc</kbd> clear
        </p>
      </div>

      {selectedItems.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-background/95 p-2 shadow-sm backdrop-blur">
          <span className="px-1 text-sm font-medium">{selectedItems.length} selected</span>
          <Button size="sm" onClick={() => setEditing(selectedItems)}>Edit</Button>
          <Button size="sm" variant="outline" onClick={markReviewed} disabled={pending}>Mark reviewed</Button>
          <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: "merge" })} disabled={selectedItems.length < 2}>Merge duplicates</Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirm({ kind: "delete" })}>Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {effectiveFilter === "review" ? "Nothing left to review." : "No items here."}
        </p>
      )}
      <div ref={gridRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {visible.map((item, index) => {
          const isSelected = selected.has(item.id);
          return (
            <div key={item.id} data-index={index} tabIndex={index === focusIndex ? 0 : -1} onFocus={() => setFocus(index)}
              className={`group relative flex flex-col overflow-hidden rounded-lg border bg-white outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-foreground ${isSelected ? "ring-2 ring-blue-600" : ""}`}>
              <button type="button" onClick={() => setEditing([item])} className="flex flex-col text-left" aria-label={`Edit ${item.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL */}
                <img src={item.imageUrl} alt="" loading="lazy" onError={onImageError} className="aspect-square w-full object-contain" />
                <span className="flex flex-col gap-0.5 border-t px-2 py-1.5 text-gray-900">
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="truncate text-xs text-gray-500">{item.subcategory} · {item.colors.join(", ")}</span>
                </span>
              </button>
              <label className="absolute left-1.5 top-1.5 flex size-8 cursor-pointer items-center justify-center rounded-md bg-white/90">
                <input type="checkbox" checked={isSelected} onChange={() => toggle(item.id)} aria-label={`Select ${item.name}`} className="size-4" />
              </label>
              {item.needsReview && (
                <span className="absolute right-1.5 top-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">review</span>
              )}
            </div>
          );
        })}
      </div>

      <GarmentEditor items={editing} open={editing.length > 0} onOpenChange={(o) => !o && setEditing([])} />

      <Dialog open={confirm?.kind === "delete"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedItems.length} item{selectedItems.length === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>Use this for bad detections (a person, a blurry frame). The images are removed too. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="destructive" disabled={pending}
              onClick={() => act(() => deleteGarments(ids), () => { setConfirm(null); setSelected(new Set()); })}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm?.kind === "merge"} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge duplicates</DialogTitle>
            <DialogDescription>Tap the photo to keep. The other {selectedItems.length - 1} will be deleted.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {selectedItems.map((item) => (
              <button key={item.id} type="button" disabled={pending}
                onClick={() => act(() => mergeGarments(item.id, ids), () => { setConfirm(null); setSelected(new Set()); })}
                className="overflow-hidden rounded-md border bg-white hover:ring-2 hover:ring-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL */}
                <img src={item.imageUrl} alt={item.name} className="aspect-square w-full object-contain" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
