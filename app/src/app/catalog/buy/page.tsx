import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/garment-tile";
import { currentUser } from "@/db/user";
import { requireAuth } from "@/lib/auth";
import { BuyList } from "./buy-list";

async function Buy() {
  await connection();
  await requireAuth();
  const user = await currentUser();
  return <BuyList initial={user.buyList ?? null} />;
}

export default function BuyPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-5 pb-8">
      <header className="flex flex-col gap-1">
        <Link href="/catalog" className="-ml-1 flex w-fit items-center gap-0.5 rounded-lg py-1 pr-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronLeft className="size-4" aria-hidden />Closet
        </Link>
        <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">Buy list</h1>
      </header>
      <Suspense fallback={<div className="flex flex-col gap-2" aria-busy><span className="sr-only" role="status">Loading…</span>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>}>
        <Buy />
      </Suspense>
    </main>
  );
}
