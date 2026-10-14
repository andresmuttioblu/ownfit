"use client";

import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Plus, Umbrella } from "lucide-react";
import { activityIcon } from "@/app/_today/activity-icon";
import { FlatLay, flatLayOrder } from "@/components/flat-lay";
import { GarmentImage } from "@/components/garment-tile";
import { EmptyHanger } from "@/components/illustrations";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { setPacked } from "./actions";
import type { TripView } from "./view";

export const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** The packing list to tick off, then the plan for each day. */
export function TripResult({ view, onNewTrip }: { view: TripView; onNewTrip: () => void }) {
  const { trip, pieces } = view;
  const [packed, setLocalPacked] = useState<readonly string[]>(trip.packed);
  const [saveFailed, setSaveFailed] = useState(false);
  const saving = useRef(Promise.resolve());
  const packedHere = packed.filter((id) => pieces[id]); // pieces deleted since packing don't count
  const capsule = flatLayOrder(trip.capsule.flatMap((id) => (pieces[id] ? [pieces[id]] : [])));

  function toggle(id: string) {
    const next = packed.includes(id) ? packed.filter((x) => x !== id) : [...packed, id];
    setLocalPacked(next);
    // one save at a time, in order, each with the whole list
    saving.current = saving.current.then(() => setPacked([...next]).then((r) => setSaveFailed(!r.ok), () => setSaveFailed(true)));
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="rise-in flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{trip.place ?? trip.destination} · {trip.days.length} {trip.days.length === 1 ? "day" : "days"}</h2>
        <p className="text-sm text-muted-foreground">
          {capsule.length ? <>{capsule.length} {capsule.length === 1 ? "piece" : "pieces"}{trip.outfits > 1 && <>, up to {trip.outfits} outfits</>}</> : "Your closet can't dress this trip yet"}
          {trip.source === "last-year" && <> · based on last year&apos;s weather</>}
        </p>
      </header>

      {capsule.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="packing-list">
          <div className="flex items-baseline justify-between">
            <h3 id="packing-list" className="font-semibold">Packing list</h3>
            <p className="text-sm text-muted-foreground" aria-live="polite">{packedHere.length} of {capsule.length} packed</p>
          </div>
          {saveFailed && <Notice tone="error">Couldn&apos;t save your ticks. They&apos;re still here on this screen.</Notice>}
          <ul className="flex flex-col gap-2">
            {capsule.map((p) => {
              const on = packed.includes(p.id);
              return (
                <li key={p.id}>
                  <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl bg-muted py-2 pr-4 pl-2 transition-colors duration-150 hover:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring">
                    <div className="w-12 shrink-0"><GarmentImage src={p.imageUrl} className={`transition-opacity duration-150 ${on ? "opacity-40" : ""}`} /></div>
                    <span className={`flex-1 text-sm first-letter:uppercase ${on ? "text-muted-foreground line-through" : ""}`}>{p.name}</span>
                    <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="size-5 accent-black dark:accent-white" />
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="day-plan">
        <h3 id="day-plan" className="font-semibold">Day by day</h3>
        <ol className="flex flex-col gap-5">
          {trip.days.map((d, i) => {
            const Icon = activityIcon(d.activity);
            const outfit = d.pieces.flatMap((id) => (pieces[id] ? [pieces[id]] : []));
            return (
              <li key={d.date} className="rise-in flex flex-col gap-2" style={{ "--i": Math.min(i, 8) } as CSSProperties}>
                <p className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{dayLabel(d.date)}</span>
                  <span className="flex items-center gap-1 text-muted-foreground capitalize">
                    <Icon className="size-4" aria-hidden />{d.activity} · {d.weather.temp}{d.weather.rain && <Umbrella className="size-4" aria-label="rain" />}
                  </span>
                </p>
                {outfit.length > 0 && outfit.length < d.pieces.length && <Notice tone="warning">Part of this outfit left your closet. Pack again to refresh the plan.</Notice>}
                {outfit.length > 0 ? (
                  <div className="flex flex-col gap-2 rounded-2xl bg-muted p-2">
                    <FlatLay pieces={outfit} tile={(p) => <GarmentImage src={p.imageUrl} alt={p.name} />} />
                    {d.why && <p className="px-2 pb-1 text-sm text-pretty text-muted-foreground">{d.why}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl border border-dashed p-4">
                    <EmptyHanger className="h-10 shrink-0 text-muted-foreground" />
                    <p className="flex-1 text-sm text-pretty text-muted-foreground">
                      {d.missing.length ? <>Nothing to wear yet: needs {d.missing.join("; ")}.</> : <>A piece from this day left your closet.</>}{" "}
                      <Link href="/catalog/buy" className="text-foreground underline underline-offset-2">Buy list</Link>
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <Button size="lg" variant="outline" onClick={onNewTrip}><Plus aria-hidden />New trip</Button>
    </div>
  );
}
