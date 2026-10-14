"use client";

import type { CSSProperties, ReactNode, Ref } from "react";
import { ChevronRight } from "lucide-react";
import { activityIcon } from "@/app/_today/activity-icon";
import { SwingingHanger } from "@/components/illustrations";
import type { Unlock } from "@/lib/outfits/filter";

/** One choice per row: muted fill, icon, label, chevron; inverted when selected. Same look as Today's activity rows. */
export const ROW = "group flex min-h-16 w-full items-center gap-3.5 rounded-2xl px-4 py-2 text-left transition-[background-color,color,transform] duration-150 ease-(--ease-out-quart) outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] disabled:opacity-50";
export const rowTone = (on: boolean) => (on ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent");

/** A big friendly drop zone for picking a photo: illustration, one line, one hint. */
export function PhotoDrop({ illustration, title, hint, inputRef, onFile }: {
  illustration: ReactNode;
  title: string;
  hint: string;
  inputRef: Ref<HTMLInputElement>;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <label className="rise-in flex min-h-72 cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border border-dashed bg-muted/50 px-6 py-8 text-center transition-[background-color,transform] duration-150 ease-(--ease-out-quart) outline-none hover:bg-muted focus-within:ring-2 focus-within:ring-ring active:scale-[0.99]">
      <span className="text-muted-foreground [&>svg]:h-24">{illustration}</span>
      <span className="flex flex-col gap-1">
        <span className="text-lg font-semibold">{title}</span>
        <span className="mx-auto max-w-[30ch] text-sm text-pretty text-muted-foreground">{hint}</span>
      </span>
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
    </label>
  );
}

/** A wait longer than a second: the swinging hanger and a short line. */
export function Wait({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground" aria-live="polite">
      <SwingingHanger className="h-16" />
      <p className="text-sm">{children}</p>
    </div>
  );
}

/** Outfit counts per activity, one row each; tapping a row asks for examples. */
export function UnlockRows({ unlocks, active, disabled, onPick }: { unlocks: Unlock[]; active: string | null; disabled: boolean; onPick: (activity: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {unlocks.map((u, i) => {
        const Icon = activityIcon(u.activity);
        const on = active === u.activity;
        return (
          <button key={u.activity} type="button" aria-pressed={on} disabled={disabled} onClick={() => onPick(u.activity)}
            className={`${ROW} rise-in ${rowTone(on)}`} style={{ "--i": i } as CSSProperties}>
            <Icon className={`size-5 shrink-0 ${on ? "" : "text-muted-foreground"}`} aria-hidden />
            <span className="flex flex-1 flex-col">
              <span className="text-base font-medium capitalize">{u.activity}</span>
              {u.isNew && <span className={`text-xs ${on ? "opacity-80" : "text-muted-foreground"}`}>Your first {u.activity} outfit</span>}
            </span>
            <span className={`text-sm ${on ? "" : "text-muted-foreground"}`}>{u.outfits} {u.outfits === 1 ? "outfit" : "outfits"}</span>
            <ChevronRight className={`size-4 transition-transform duration-150 group-hover:translate-x-0.5 ${on ? "" : "text-muted-foreground"}`} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
