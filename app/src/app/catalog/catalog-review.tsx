"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Merge, Pencil, Trash2, X } from "lucide-react";
import { GarmentImage } from "@/components/garment-tile";
import { Notice } from "@/components/notice";
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
  const [selecting, setSelecting] = useState(false); // phone: checkboxes only in select mode (always shown on desktop)
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
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Filter" value={effectiveFilter} onChange={(e) => setFilter(e.target.value)}
          className="h-11 rounded-xl bg-muted px-3 text-base capitalize outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
          <option value="all">All ({items.length})</option>
          <option value="review">Needs review ({reviewCount})</option>
          {CATEGORIES.filter((c) => items.some((i) => i.category === c)).map((c) => (
            <option key={c} value={c}>{c} ({items.filter((i) => i.category === c).length})</option>
          ))}
        </select>
        <Button variant="ghost" className="ml-auto text-muted-foreground hover:text-foreground lg:hidden" 
          onClick={() => { if (selecting) setSelected(new Set()); setSelecting(!selecting); }}>{selecting ? "Done" : "Select"}</Button>
        <p className="hidden text-xs text-muted-foreground lg:block">
          Arrows move · <kbd>x</kbd> select · <kbd>e</kbd> edit · <kbd>m</kbd> merge · <kbd>r</kbd> reviewed · <kbd>Del</kbd> delete · <kbd>Esc</kbd> clear
        </p>
      </div>

      {selectedItems.length > 0 && (
        <div className="rise-in sticky top-2 z-10 flex items-center gap-1 rounded-2xl bg-primary p-1.5 pl-4 text-primary-foreground shadow-lg">
          <span className="flex-1 text-sm font-medium">{selectedItems.length} selected</span>
          <BarButton label="Edit" onClick={() => setEditing(selectedItems)}><Pencil aria-hidden /></BarButton>
          <BarButton label="Mark reviewed" onClick={markReviewed} disabled={pending}><Check aria-hidden /></BarButton>
          <BarButton label="Merge duplicates" onClick={() => setConfirm({ kind: "merge" })} disabled={selectedItems.length < 2}><Merge aria-hidden /></BarButton>
          <BarButton label="Delete" onClick={() => setConfirm({ kind: "delete" })}><Trash2 aria-hidden /></BarButton>
          <BarButton label="Clear selection" onClick={() => setSelected(new Set())}><X aria-hidden /></BarButton>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {visible.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {effectiveFilter === "review" ? "All caught up. Nothing left to review." : "Nothing here."}
        </p>
      )}
      <div ref={gridRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {visible.map((item, index) => {
          const isSelected = selected.has(item.id);
          return (
            <div key={item.id} data-index={index} tabIndex={index === focusIndex ? 0 : -1} onFocus={() => setFocus(index)} style={{ "--i": Math.min(index, 8) } as React.CSSProperties}
              className={`rise-in group relative flex flex-col gap-1.5 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${isSelected ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}>
              <button type="button" onClick={() => setEditing([item])} className="flex flex-col gap-1.5 rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-transform duration-150 ease-(--ease-out-quart) active:scale-[0.99]" aria-label={`Edit ${item.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL; GarmentImage has no onError */}
                <img src={item.imageUrl} alt="" loading="lazy" onError={onImageError} className="aspect-square w-full rounded-2xl bg-tile object-contain ring-1 ring-border ring-inset dark:ring-0" />
                <span className="truncate px-1 text-sm text-muted-foreground">{item.name}</span>
              </button>
              <label className={`absolute top-0 left-0 size-11 cursor-pointer items-center justify-center ${selecting || selected.size ? "flex" : "hidden lg:flex"}`}>
                <input type="checkbox" checked={isSelected} onChange={() => toggle(item.id)} aria-label={`Select ${item.name}`} className="size-5 rounded bg-background accent-black shadow-[0_0_0_3px_white]" />
              </label>
              {item.needsReview && (
                <span className="absolute top-2 right-2 size-2.5 rounded-full bg-black ring-2 ring-white" role="img" aria-label="Needs review" />
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
            <Button variant="ghost" size="lg" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="destructive" size="lg" disabled={pending}
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
                className="rounded-xl outline-none transition-shadow duration-150 hover:ring-2 hover:ring-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <GarmentImage src={item.imageUrl} alt={item.name} />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BarButton({ label, children, ...props }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Button type="button" variant="ghost" size="icon-lg" aria-label={label} title={label}
      className="rounded-xl text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground dark:hover:bg-primary-foreground/15" {...props}>
      {children}
    </Button>
  );
}
