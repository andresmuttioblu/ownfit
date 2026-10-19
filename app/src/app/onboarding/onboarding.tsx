"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Plus, Shirt, Sparkles, type LucideIcon } from "lucide-react";
import { SwingingHanger } from "@/components/illustrations";
import { Notice } from "@/components/notice";
import { activityIcon } from "@/app/_today/activity-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/app/catalog/tag-fields";
import { ROUNDS, type Convention } from "@/lib/style/presets";
import { STYLE_VOCAB, type StyleSummary } from "@/lib/style/profile";
import type { Coloring } from "@/lib/style/coloring";
import { saveOnboarding } from "./actions";
import { ColorsStep, NO_COLORING } from "./colors-step";
import { FilmingGuide } from "./filming-guide";
import { References, type Reference } from "./references";
import { StyleRound } from "./style-round";

export type Prefill = { name: string; age: number | null; conventions: Convention[]; activities: string[]; coloring: Coloring | null };

// about, 5 rounds, references, colors, activities, filming guide
const STEPS = ["about", ...ROUNDS.map((_, i) => `round-${i}`), "references", "colors", "activities", "filming"] as const;
const { limits } = STYLE_VOCAB;
const CONVENTION_ICONS: Record<Convention, LucideIcon> = { menswear: Shirt, womenswear: Sparkles };
const TITLES = { about: "About you", references: "Outfits you like", colors: "Colors that suit you", activities: "What do you usually dress for?", filming: "Last thing: your closet" } as const;

export function Onboarding({ prefill }: { prefill: Prefill }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(prefill.name);
  const [age, setAge] = useState(prefill.age?.toString() ?? "");
  const [conventions, setConventions] = useState<Convention[]>(prefill.conventions);
  const [picks, setPicks] = useState<(string | null | undefined)[]>(ROUNDS.map(() => undefined));
  const [references, setReferences] = useState<Reference[]>([]);
  const [reading, setReading] = useState(false);
  const shownRefs = useRef(references); // previews are released when the page goes away
  useEffect(() => { shownRefs.current = references; }, [references]);
  useEffect(() => () => shownRefs.current.forEach((r) => URL.revokeObjectURL(r.previewUrl)), []);
  const [activities, setActivities] = useState<string[]>(prefill.activities.length ? prefill.activities : ["office", "casual"]);
  const [coloring, setColoring] = useState<Coloring>(prefill.coloring ?? NO_COLORING);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<StyleSummary | null>(null);
  const [pending, startTransition] = useTransition();

  const current = STEPS[step];
  const roundIndex = current.startsWith("round-") ? Number(current.slice(6)) : -1;
  const ageNumber = age.trim() === "" ? null : Number(age);
  const canContinue =
    current === "about" ? conventions.length > 0 && (ageNumber === null || (Number.isInteger(ageNumber) && ageNumber > 0 && ageNumber <= 120))
    : roundIndex >= 0 ? picks[roundIndex] !== undefined
    : current === "references" ? !reading
    : current === "activities" ? activities.length > 0
    : true;

  function toggleActivity(a: string) {
    if (activities.includes(a)) setActivities(activities.filter((x) => x !== a));
    else if (activities.length < limits.activities) setActivities([...activities, a]);
  }

  function addCustom() {
    const a = custom.trim().toLowerCase();
    if (a && a.length <= limits.activity_length && !activities.includes(a) && activities.length < limits.activities) setActivities([...activities, a]);
    setCustom("");
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const result = await saveOnboarding({
        name, age: ageNumber, conventions, picks: picks.map((p) => p ?? null),
        references: references.map((r) => r.weights), activities, coloring,
      });
      if (result.ok) setProfile(result.profile);
      else setError(result.error);
    });
  }

  if (profile) return <Done profile={profile} />;

  const last = step === STEPS.length - 1;
  const activityOptions = [...new Set([...STYLE_VOCAB.activities, ...activities])];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.9375rem] font-semibold tracking-tight">Your style</span>
          <span className="text-sm text-muted-foreground" aria-hidden>{step + 1} of {STEPS.length}</span>
        </div>
        <div className="flex gap-1" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          {STEPS.map((s, i) => <span key={s} className={`h-1 flex-1 rounded-full transition-colors duration-200 ease-(--ease-out-quart) ${i <= step ? "bg-primary" : "bg-muted"}`} />)}
        </div>
      </header>

      <div key={current} className="rise-in flex flex-1 flex-col gap-4">
        {current === "about" && (
          <>
            <h2 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">About you</h2>
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <Field label="Name"><Input className="h-11" placeholder="Optional" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Age"><Input className="h-11" placeholder="Optional" value={age} inputMode="numeric" onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} /></Field>
            </div>
            <p className="pt-2 text-base font-medium">What do you wear? Pick one or both</p>
            <div className="flex flex-col gap-2">
              {STYLE_VOCAB.conventions.map((c) => (
                <ChoiceRow key={c} Icon={CONVENTION_ICONS[c as Convention]} label={c} on={conventions.includes(c as Convention)}
                  onClick={() => setConventions(conventions.includes(c as Convention) ? conventions.filter((x) => x !== c) : [...conventions, c as Convention])} />
              ))}
            </div>
          </>
        )}

        {roundIndex >= 0 && (
          <>
            <h2 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">Which is most you?</h2>
            <StyleRound round={ROUNDS[roundIndex]} conventions={conventions} picked={picks[roundIndex]}
              onPick={(style) => setPicks(picks.map((p, i) => (i === roundIndex ? style : p)))} />
          </>
        )}

        {current === "references" && (
          <>
            <h2 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">{TITLES.references} <span className="text-base font-normal text-muted-foreground">optional</span></h2>
            <References value={references} onChange={setReferences} busy={reading} setBusy={setReading} />
          </>
        )}

        {current === "colors" && (
          <>
            <h2 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">{TITLES.colors} <span className="text-base font-normal text-muted-foreground">optional</span></h2>
            <ColorsStep value={coloring} onChange={setColoring} />
          </>
        )}

        {current === "activities" && (
          <>
            <h2 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">{TITLES.activities}</h2>
            <p className="text-sm text-muted-foreground">These become your buttons for picking an outfit each day.</p>
            <div className="flex flex-col gap-2">
              {activityOptions.map((a) => (
                <ChoiceRow key={a} Icon={activityIcon(a)} label={a} on={activities.includes(a)}
                  disabled={!activities.includes(a) && activities.length >= limits.activities} onClick={() => toggleActivity(a)} />
              ))}
              <form className="flex h-16 items-center gap-2 rounded-2xl border border-dashed pr-2 pl-4 focus-within:ring-2 focus-within:ring-ring"
                onSubmit={(e) => { e.preventDefault(); addCustom(); }}>
                <Plus className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <input value={custom} maxLength={limits.activity_length} placeholder="Add your own, e.g. date night" aria-label="Add your own"
                  className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                  onChange={(e) => setCustom(e.target.value)} />
                <Button type="submit" variant="ghost" size="icon-lg" className="rounded-xl" aria-label="Add activity" disabled={!custom.trim()}><Check aria-hidden /></Button>
              </form>
            </div>
          </>
        )}

        {current === "filming" && (
          <>
            <h2 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">{TITLES.filming}</h2>
            <FilmingGuide />
          </>
        )}
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex gap-2">
        {step > 0 && (
          <Button variant="outline" size="icon-lg" className="size-12 rounded-xl" aria-label="Back" onClick={() => setStep(step - 1)} disabled={pending}><ArrowLeft aria-hidden /></Button>
        )}
        {last
          ? <Button className="h-12 flex-1 rounded-xl text-base" onClick={finish} disabled={pending}>{pending ? "Saving…" : "Finish"}</Button>
          : <Button className="h-12 flex-1 rounded-xl text-base" onClick={() => setStep(step + 1)} disabled={!canContinue}>Continue</Button>}
      </div>
    </div>
  );
}

/** A toggle row in the shared choice-row style: icon, label, check; inverted when on. */
function ChoiceRow({ Icon, label, on, onClick, disabled }: { Icon: LucideIcon; label: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={onClick}
      className={`flex h-16 items-center gap-3.5 rounded-2xl px-4 text-left transition-[background-color,color,transform] duration-150 ease-(--ease-out-quart) outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] disabled:opacity-50 ${on ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}>
      <Icon className={`size-5 shrink-0 ${on ? "" : "text-muted-foreground"}`} aria-hidden />
      <span className="flex-1 text-base font-medium capitalize">{label}</span>
      <Check className={`size-4 transition-opacity duration-150 ${on ? "opacity-100" : "opacity-0"}`} aria-hidden />
    </button>
  );
}

function Done({ profile }: { profile: StyleSummary }) {
  const top = (d: Record<string, number>, n = 3) => Object.keys(d).slice(0, n).join(", ") || "not enough picks yet";
  const rows: [string, string][] = [
    ["Leaning", top(profile.archetypes)],
    ["Colours", top(profile.palette)],
    ["Fit", top(profile.fit, 2)],
    ["Formality", `${profile.formalityLean ?? "–"} / 5`],
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="rise-in flex flex-col items-center gap-3 pt-4 text-center">
        <SwingingHanger className="h-16 text-muted-foreground" />
        <h2 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">That&apos;s your style</h2>
        <p className="max-w-[32ch] text-sm text-pretty text-muted-foreground">It keeps learning from what you wear and the outfits you like or skip.</p>
      </div>
      <dl className="flex flex-col gap-2">
        {rows.map(([k, v], i) => (
          <div key={k} className="rise-in flex items-baseline justify-between gap-4 rounded-2xl bg-muted px-4 py-3.5" style={{ "--i": i + 1 } as React.CSSProperties}>
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd className="text-right text-base font-medium capitalize">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2">
        <Button className="h-12 rounded-xl text-base" nativeButton={false} render={<Link href="/add" />}>Add your first piece</Button>
        <Button variant="ghost" className="h-12 rounded-xl text-base" nativeButton={false} render={<Link href="/" />}>Not now</Button>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Profile data</summary>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-muted p-3">{JSON.stringify(profile, null, 2)}</pre>
      </details>
    </div>
  );
}
