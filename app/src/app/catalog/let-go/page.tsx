import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/garment-tile";
import { db } from "@/db";
import { garments, outfitEvents } from "@/db/schema";
import { currentUser } from "@/db/user";
import { requireAuth } from "@/lib/auth";
import { letGoList } from "@/lib/lists/let-go";
import { signedGetUrl } from "@/lib/r2";
import { LetGo, type LetGoRow } from "./let-go";

const monthYear = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en", { month: "short", year: "numeric", timeZone: "UTC" });

async function List() {
  await connection();
  await requireAuth();
  const user = await currentUser();
  const [pieces, worn] = await Promise.all([
    db.select().from(garments).where(and(eq(garments.userId, user.id), inArray(garments.status, ["active", "retired"]))),
    db.select({ ids: outfitEvents.garmentIds, date: outfitEvents.localDate }).from(outfitEvents)
      .where(and(eq(outfitEvents.userId, user.id), eq(outfitEvents.kind, "wore"))),
  ]);
  const lastWorn = new Map<string, string>();
  for (const e of worn) for (const id of e.ids) if ((lastWorn.get(id) ?? "") < e.date) lastWorn.set(id, e.date);
  const today = new Date().toISOString().slice(0, 10); // server date; a day off near midnight only shifts the 12-month window
  const items = letGoList(pieces.map((p) => ({ ...p, lastWorn: lastWorn.get(p.id) ?? null })), today);
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const rows: LetGoRow[] = await Promise.all(items.map(async ({ piece, reason }) => ({
    id: piece.id, name: piece.name, reason,
    imageUrl: await signedGetUrl(byId.get(piece.id)!.imageKey),
    detail: reason === "disliked" ? "Retired" : piece.lastWorn ? `Last worn ${monthYear(piece.lastWorn)}` : "Never worn in Ownfit",
  })));
  return <LetGo rows={rows} />;
}

export default function LetGoPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-5 pb-8">
      <header className="flex flex-col gap-1">
        <Link href="/catalog" className="-ml-1 flex w-fit items-center gap-0.5 rounded-lg py-1 pr-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronLeft className="size-4" aria-hidden />Closet
        </Link>
        <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">Sell or donate</h1>
      </header>
      <Suspense fallback={<div className="flex flex-col gap-2" aria-busy><span className="sr-only" role="status">Loading…</span>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>}>
        <List />
      </Suspense>
    </main>
  );
}
