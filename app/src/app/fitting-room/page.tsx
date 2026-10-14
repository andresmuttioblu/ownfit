import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { currentUser } from "@/db/user";
import { requireAuth } from "@/lib/auth";
import { DEFAULT_WEATHER } from "@/lib/outfits/filter";
import { FittingRoom } from "./fitting-room";

async function Room() {
  await connection();
  await requireAuth();
  const user = await currentUser().catch((e) => { console.error("fitting room: database not reachable", e); return null; });
  return <FittingRoom weather={user?.weather ?? DEFAULT_WEATHER} />;
}

export default function FittingRoomPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Should I buy this?</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">Home</Link>
      </header>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}><Room /></Suspense>
    </main>
  );
}
