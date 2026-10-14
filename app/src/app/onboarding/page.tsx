import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { currentUser } from "@/db/user";
import { requireAuth } from "@/lib/auth";
import type { Convention } from "@/lib/style/presets";
import { Onboarding } from "./onboarding";

async function Loaded() {
  await connection();
  await requireAuth();
  const user = await currentUser();
  return <Onboarding prefill={{ name: user.name ?? "", age: user.age, conventions: user.conventions as Convention[], activities: user.activities }} />;
}

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your style</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">Home</Link>
      </header>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Loaded />
      </Suspense>
    </main>
  );
}
