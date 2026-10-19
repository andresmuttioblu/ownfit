import { Suspense } from "react";
import { connection } from "next/server";
import { currentUser } from "@/db/user";
import { requireAuth } from "@/lib/auth";
import { knownColors } from "@/lib/style/coloring";
import type { Convention } from "@/lib/style/presets";
import { Onboarding } from "./onboarding";

async function Loaded() {
  await connection();
  await requireAuth();
  const user = await currentUser();
  return <Onboarding prefill={{ name: user.name ?? "", age: user.age, conventions: user.conventions as Convention[], activities: user.activities, coloring: knownColors(user.coloring) }} />;
}

function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="h-1 rounded-full bg-muted" />
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="h-16 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      <div className="h-16 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-5 pb-8">
      <h1 className="sr-only">Your style</h1>
      <Suspense fallback={<Loading />}>
        <Loaded />
      </Suspense>
    </main>
  );
}
