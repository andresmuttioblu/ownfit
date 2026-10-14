import { Suspense } from "react";
import { connection } from "next/server";
import { Skeleton } from "@/components/garment-tile";
import { currentUser } from "@/db/user";
import { requireAuth } from "@/lib/auth";
import { DEFAULT_WEATHER } from "@/lib/outfits/filter";
import { AddGarment } from "./add-garment";

async function Add() {
  await connection();
  await requireAuth();
  const user = await currentUser().catch((e) => { console.error("add: database not reachable", e); return null; });
  return <AddGarment weather={user?.weather ?? DEFAULT_WEATHER} />;
}

export default function AddPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-5 pb-8">
      <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">Add to your closet</h1>
      <Suspense fallback={<Skeleton className="h-72 rounded-3xl" />}><Add /></Suspense>
    </main>
  );
}
