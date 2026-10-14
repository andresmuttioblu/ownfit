import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { DEFAULT_WEATHER } from "@/lib/outfits/filter";
import STYLE_VOCAB from "@/lib/style/style-vocab.json";
import { Today } from "./_today/today";

async function loadUser() {
  try {
    const { currentUser } = await import("@/db/user");
    return await currentUser();
  } catch (error) {
    console.error("home: database not reachable", error);
    return null;
  }
}

async function Home() {
  await connection();
  await requireAuth();
  const user = await loadUser();
  if (!user) return <p className="text-red-700">Database not reachable — check DATABASE_URL.</p>;
  return (
    <>
      {!user.onboardedAt && (
        <Link href="/onboarding" className="rounded-lg border p-4 hover:bg-muted">
          <span className="font-medium">Set up your style</span>
          <span className="block text-sm text-muted-foreground">Five quick rounds so outfit suggestions fit your taste.</span>
        </Link>
      )}
      <Today activities={user.activities.length ? user.activities : STYLE_VOCAB.activities} initialWeather={user.weather ?? DEFAULT_WEATHER} />
      <Link href="/add" className="text-center text-sm text-muted-foreground hover:underline">Bought something new? Add it</Link>
    </>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4 sm:p-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Ownfit</h1>
        <nav className="flex gap-3 text-sm text-muted-foreground">
          <Link href="/catalog" className="hover:underline">Catalog</Link>
          <Link href="/add" className="hover:underline">Add</Link>
          <Link href="/onboarding" className="hover:underline">Style</Link>
        </nav>
      </header>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Home />
      </Suspense>
    </main>
  );
}
