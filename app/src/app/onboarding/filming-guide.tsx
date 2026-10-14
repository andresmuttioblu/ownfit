import { Camera, FolderOpen } from "lucide-react";
import { CameraShirt } from "@/components/illustrations";

const FILM_STEPS = [
  "Prop your phone up in portrait, about 2 m away. Even light and a plain wall behind you help.",
  "Start recording and stand still with empty hands for about 3 seconds. That frame is how the import tells you and the clothes apart.",
  "Hold up one piece at a time for 2–3 seconds, still, then swap. Hang-ups and folded items both work.",
  "Keep going through the whole closet. Several shorter clips are fine; start each with the 3 empty-handed seconds.",
  "Shoot in SDR if you can (on iPhone, turn off HDR video); HDR footage looks washed out.",
];

const PHOTO_TIPS = [
  "One item per photo, nothing else in the frame.",
  "Laid flat or on a hanger, against a plain background.",
  "JPEG, PNG or HEIC, straight from the phone is fine.",
  "Put them in one folder next to your videos, then tell Claude Code “import my closet”.",
];

/** How to film the closet for the local import (Stage 2 pipeline). */
export function FilmingGuide() {
  return (
    <div className="flex flex-col gap-6">
      <CameraShirt className="rise-in mx-auto h-16 text-muted-foreground" />
      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 font-medium"><Camera className="size-4 text-muted-foreground" aria-hidden />Film your closet</h3>
        <ol className="flex flex-col gap-3">
          {FILM_STEPS.map((text, i) => (
            <li key={i} className="rise-in flex gap-3 text-sm text-muted-foreground" style={{ "--i": i } as React.CSSProperties}>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground" aria-hidden>{i + 1}</span>
              <span className="pt-0.5 text-pretty">{text}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 font-medium"><FolderOpen className="size-4 text-muted-foreground" aria-hidden />Or a folder of photos</h3>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          {PHOTO_TIPS.map((text) => <li key={text} className="rounded-xl bg-muted px-3.5 py-2.5 text-pretty">{text}</li>)}
        </ul>
      </section>
    </div>
  );
}
