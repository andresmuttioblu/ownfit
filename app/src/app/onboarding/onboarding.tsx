"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chips, Field } from "@/app/catalog/tag-fields";
import { ROUNDS, type Convention } from "@/lib/style/presets";
import { STYLE_VOCAB, type StyleSummary } from "@/lib/style/profile";
import { saveOnboarding } from "./actions";
import { FilmingGuide } from "./filming-guide";
import { References, type Reference } from "./references";
import { StyleRound } from "./style-round";

export type Prefill = { name: string; age: number | null; conventions: Convention[]; activities: string[] };

// about, 5 rounds, references, activities, filming guide
const STEPS = ["about", ...ROUNDS.map((_, i) => `round-${i}`), "references", "activities", "filming"] as const;
const { limits } = STYLE_VOCAB;

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
        references: references.map((r) => r.weights), activities,
      });
      if (result.ok) setProfile(result.profile);
      else setError(result.error);
    });
  }

  if (profile) return <Done profile={profile} />;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</p>

      {current === "about" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">About you</h2>
          <Field label="Name (optional)"><Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Age (optional)"><Input value={age} inputMode="numeric" onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} /></Field>
          <Field label="What do you wear? Pick one or both">
            <Chips options={STYLE_VOCAB.conventions} value={conventions} onChange={(v) => setConventions(v as Convention[])} />
          </Field>
        </div>
      )}

      {roundIndex >= 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Which is most you? <span className="text-muted-foreground">({roundIndex + 1} of {ROUNDS.length})</span></h2>
          <StyleRound round={ROUNDS[roundIndex]} conventions={conventions} picked={picks[roundIndex]}
            onPick={(style) => setPicks(picks.map((p, i) => (i === roundIndex ? style : p)))} />
        </div>
      )}

      {current === "references" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Outfits you like <span className="text-muted-foreground">(optional)</span></h2>
          <References value={references} onChange={setReferences} busy={reading} setBusy={setReading} />
        </div>
      )}

      {current === "activities" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">What do you usually dress for?</h2>
          <p className="text-sm text-muted-foreground">These become your buttons for picking an outfit each day.</p>
          <Chips options={[...new Set([...STYLE_VOCAB.activities, ...activities])]} value={activities} onChange={setActivities} max={limits.activities} />
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addCustom(); }}>
            <Input value={custom} maxLength={limits.activity_length} placeholder="Add your own, e.g. date night" onChange={(e) => setCustom(e.target.value)} />
            <Button type="submit" variant="outline" disabled={!custom.trim()}>Add</Button>
          </form>
        </div>
      )}

      {current === "filming" && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Last thing: getting your closet in</h2>
          <FilmingGuide />
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} disabled={pending}>Back</Button>}
        {step < STEPS.length - 1
          ? <Button className="flex-1" onClick={() => setStep(step + 1)} disabled={!canContinue}>Continue</Button>
          : <Button className="flex-1" onClick={finish} disabled={pending}>{pending ? "Saving…" : "Finish"}</Button>}
      </div>
    </div>
  );
}

function Done({ profile }: { profile: StyleSummary }) {
  const top = (d: Record<string, number>, n = 3) => Object.keys(d).slice(0, n).join(", ") || "not enough picks yet";
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Your style, so far</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Leaning</dt><dd>{top(profile.archetypes)}</dd>
        <dt className="text-muted-foreground">Colours</dt><dd>{top(profile.palette)}</dd>
        <dt className="text-muted-foreground">Fit</dt><dd>{top(profile.fit, 2)}</dd>
        <dt className="text-muted-foreground">Formality</dt><dd>{profile.formalityLean ?? "–"} / 5</dd>
      </dl>
      <p className="text-sm text-muted-foreground">It keeps learning from what you wear and the outfits you like or skip.</p>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Profile data</summary>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3">{JSON.stringify(profile, null, 2)}</pre>
      </details>
      <div className="flex gap-2">
        <Button className="flex-1" nativeButton={false} render={<Link href="/add" />}>Add an item</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>Home</Button>
      </div>
    </div>
  );
}
