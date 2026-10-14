import { Suspense } from "react";
import { connection } from "next/server";
import { Skeleton } from "@/components/garment-tile";
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-5 pb-8">
      <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">Should I buy this?</h1>
      <Suspense fallback={<Skeleton className="h-72 rounded-3xl" />}><Room /></Suspense>
    </main>
  );
}
