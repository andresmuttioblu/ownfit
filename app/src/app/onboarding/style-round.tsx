"use client";

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
      <div className="grid grid-cols-2 gap-2">
        {round.styles.map(({ style, photos }) => {
          const photo = photos[convention];
          const on = picked === style;
          return (
            <figure key={style} className="flex flex-col gap-1">
              <button type="button" onClick={() => onPick(style)} role="radio" aria-checked={on} aria-label={`${style}: ${photo.alt}`}
                className={`overflow-hidden rounded-lg border-2 transition ${on ? "border-foreground" : "border-transparent hover:opacity-90"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- linked from Unsplash, not copied */}
                <img src={presetSrc(photo)} alt="" loading="lazy" className="aspect-[3/4] w-full bg-muted object-cover" />
              </button>
              <figcaption className="truncate text-[11px] text-muted-foreground">
                Photo: <a href={`${photo.page}?utm_source=ownfit&utm_medium=referral`} target="_blank" rel="noreferrer" className="underline">{photo.credit.name}</a> / Unsplash
              </figcaption>
            </figure>
          );
        })}
      </div>
      <button type="button" onClick={() => onPick(null)} role="radio" aria-checked={picked === null}
        className={`self-center text-sm underline-offset-2 ${picked === null ? "font-medium underline" : "text-muted-foreground hover:underline"}`}>
        None of these
      </button>
    </div>
  );
}
