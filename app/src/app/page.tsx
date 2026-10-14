import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { sql } from "drizzle-orm";

async function isDbReachable() {
  try {
    const { db } = await import("@/db");
    await db.execute(sql`select 1`);
    return true;
  } catch (error) {
    console.error("DB check failed", error);
    return false;
  }
}

async function DbStatus() {
  await connection();
  return (await isDbReachable())
    ? <p className="text-green-700">Database: connected</p>
    : <p className="text-red-700">Database: not reachable — check DATABASE_URL</p>;
}

async function isOnboarded(): Promise<boolean | null> {
  try {
    const { currentUser } = await import("@/db/user");
    return Boolean((await currentUser()).onboardedAt);
  } catch (error) {
    console.error("style prompt failed", error);
    return null; // DbStatus below reports the database problem
  }
}

async function StylePrompt() {
  await connection();
  const onboarded = await isOnboarded();
  if (onboarded === null) return null;
  return onboarded
    ? <p className="text-sm text-muted-foreground"><Link href="/onboarding" className="underline">Redo your style quiz</Link></p>
    : (
      <Link href="/onboarding" className="rounded-lg border p-4 hover:bg-muted">
        <span className="font-medium">Set up your style</span>
        <span className="block text-sm text-muted-foreground">Five quick rounds so outfit suggestions fit your taste.</span>
      </Link>
    );
}

export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center gap-3 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Ownfit is set up</h1>
      <p className="text-muted-foreground">
        <Link href="/catalog" className="underline">Open your catalog</Link> · <Link href="/add" className="underline">Add an item</Link>
      </p>
      <Suspense fallback={null}>
        <StylePrompt />
      </Suspense>
      <Suspense fallback={<p>Database: checking…</p>}>
        <DbStatus />
      </Suspense>
    </main>
  );
}
