/** How to film the closet for the local import (Stage 2 pipeline). */
export function FilmingGuide() {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <section className="flex flex-col gap-1.5">
        <h3 className="font-medium">Film your closet</h3>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Prop your phone up or use a tripod, in portrait, about 2 m away. Good, even light; a plain wall behind you helps.</li>
          <li>Start recording and stand still with empty hands for about 3 seconds. That frame is how the import tells you and the clothes apart.</li>
          <li>Hold up one piece at a time in front of you for 2–3 seconds, still, then swap. Hang-ups and folded items both work.</li>
          <li>Keep going through the whole closet; several shorter clips are fine. Start each clip with the 3 empty-handed seconds.</li>
          <li>Shoot in SDR if your phone offers it (on iPhone, turn off HDR video); HDR footage looks washed out.</li>
        </ol>
      </section>
      <section className="flex flex-col gap-1.5">
        <h3 className="font-medium">Loose photos folder</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>One item per photo, nothing else in the frame (no people, no other clothes).</li>
          <li>Laid flat or on a hanger, against a plain background.</li>
          <li>JPEG, PNG or HEIC, straight from the phone is fine.</li>
          <li>Put them in one folder next to your videos, then tell Claude Code “import my closet”.</li>
        </ul>
      </section>
    </div>
  );
}
