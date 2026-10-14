import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { ChevronRight, HandHeart, Plus, ShoppingBag } from "lucide-react";
import { db } from "@/db";
import { garments } from "@/db/schema";
import { Skeleton } from "@/components/garment-tile";
import { EmptyRail } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { signedGetUrl } from "@/lib/r2";
import { CatalogReview, type CatalogItem } from "./catalog-review";

const LISTS = [
  { href: "/catalog/buy", label: "Buy list", hint: "Pieces that would unlock the most outfits", icon: ShoppingBag },
  { href: "/catalog/let-go", label: "Sell or donate", hint: "Unworn, unloved and duplicates", icon: HandHeart },
] as const;

async function Catalog() {
  await connection();
  await requireAuth();
  const rows = await db.select().from(garments).where(eq(garments.status, "active"))
    .orderBy(desc(garments.needsReview), asc(garments.category), asc(garments.createdAt));
  const items: CatalogItem[] = await Promise.all(rows.map(async (g) => ({
    id: g.id, name: g.name, category: g.category, subcategory: g.subcategory, colors: g.colors,
    pattern: g.pattern, material: g.material, formality: g.formality, warmth: g.warmth,
    seasons: g.seasons, tags: g.tags, needsReview: g.needsReview,
    imageUrl: await signedGetUrl(g.imageKey),
  })));
  if (items.length === 0) {
    return (
      <div className="rise-in flex flex-col items-center gap-4 py-12 text-center">
        <EmptyRail className="h-20 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">Nothing on the rail yet</p>
          <p className="max-w-[32ch] text-sm text-pretty text-muted-foreground">Snap a photo of a piece and it lands here, tagged and ready. Got a whole closet? Film it and ask Claude Code to &ldquo;import my closet&rdquo;.</p>
        </div>
        <Button size="lg" nativeButton={false} render={<Link href="/add" />}><Plus aria-hidden />Add a piece</Button>
      </div>
    );
  }
  return <CatalogReview items={items} />;
}

export default function CatalogPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-5 pb-8 lg:max-w-5xl">
      <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.01em]">Closet</h1>
      <nav aria-label="Closet lists" className="flex flex-col gap-2 lg:flex-row">
        {LISTS.map(({ href, label, hint, icon: Icon }) => (
          <Link key={href} href={href} className="group flex min-h-16 flex-1 items-center gap-3.5 rounded-2xl bg-muted px-4 py-2 outline-none transition-[background-color,transform] duration-150 ease-(--ease-out-quart) hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]">
            <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="flex flex-1 flex-col">
              <span className="font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">{hint}</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ))}
      </nav>
      <Suspense fallback={<CatalogLoading />}>
        <Catalog />
      </Suspense>
    </main>
  );
}

function CatalogLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <span className="sr-only" role="status">Loading your closet…</span>
      <Skeleton className="h-11 w-40" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}</div>
    </div>
  );
}
