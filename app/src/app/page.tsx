import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/garment-tile";
import { Notice } from "@/components/notice";
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
  if (!user) return <Notice tone="error">Can&apos;t reach the database. Check DATABASE_URL in your Vercel settings.</Notice>;
  return (
    <>
      <Today activities={user.activities.length ? user.activities : STYLE_VOCAB.activities} initialWeather={user.weather ?? DEFAULT_WEATHER}>
      {!user.onboardedAt && (
        <Link href="/onboarding" className="group flex items-center gap-3 rounded-2xl bg-muted p-4 outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="font-medium">Set up your style</span>
            <span className="text-sm text-muted-foreground">Five quick rounds so suggestions fit your taste.</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
      </Today>
    </>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-5 pb-8">
      <Suspense fallback={<HomeLoading />}>
        <Home />
      </Suspense>
    </main>
  );
}

function HomeLoading() {
  return (
    <div className="flex flex-col gap-7" aria-busy>
      <span className="sr-only" role="status">Loading…</span>
      <Skeleton className="h-9 w-24 self-end rounded-full" />
      <Skeleton className="h-8 w-3/4" />
      <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
    </div>
  );
}
