"use client";

import { Check, X } from "lucide-react";
import { conventionFor, presetSrc, type Convention, type Round } from "@/lib/style/presets";

/** One style round: four photos, tap the one closest to your taste. */
export function StyleRound({ round, conventions, picked, onPick }: {
  round: Round;
  conventions: Convention[];
  picked: string | null | undefined;
  onPick: (style: string | null) => void;
}) {
  const convention = conventionFor(round.round, conventions);
  return (
    <div className="flex flex-col gap-3" role="radiogroup" aria-label="Which is most you?">
      <div className="grid grid-cols-2 gap-3">
        {round.styles.map(({ style, photos }, i) => {
          const photo = photos[convention];
          const on = picked === style;
          return (
            <figure key={style} className="rise-in flex flex-col gap-1.5" style={{ "--i": i } as React.CSSProperties}>
              <button type="button" onClick={() => onPick(style)} role="radio" aria-checked={on} aria-label={`${style}: ${photo.alt}`}
                className={`group relative overflow-hidden rounded-2xl outline-none transition-[box-shadow,opacity,transform] duration-150 ease-(--ease-out-quart) focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] ${on ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : picked !== undefined ? "opacity-60 hover:opacity-90" : "hover:opacity-90"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- linked from Unsplash, not copied */}
                <img src={presetSrc(photo)} alt="" loading="lazy" className="aspect-[3/4] w-full bg-muted object-cover" />
                <span aria-hidden className={`absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[opacity,transform] duration-150 ease-(--ease-out-quart) ${on ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}>
                  <Check className="size-4" strokeWidth={2.25} />
                </span>
              </button>
              <figcaption className="truncate text-xs text-muted-foreground">
                <a href={`${photo.page}?utm_source=ownfit&utm_medium=referral`} target="_blank" rel="noreferrer" className="underline underline-offset-2">{photo.credit.name}</a> / <a href="https://unsplash.com/?utm_source=ownfit&utm_medium=referral" target="_blank" rel="noreferrer" className="underline underline-offset-2">Unsplash</a>
              </figcaption>
            </figure>
          );
        })}
      </div>
      <button type="button" onClick={() => onPick(null)} role="radio" aria-checked={picked === null}
        className={`flex h-12 items-center gap-3.5 rounded-2xl px-4 text-left text-base font-medium outline-none transition-[background-color,color,transform] duration-150 ease-(--ease-out-quart) focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] ${picked === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
        <X className="size-5 shrink-0" aria-hidden />
        <span className="flex-1">None of these</span>
        {picked === null && <Check className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
