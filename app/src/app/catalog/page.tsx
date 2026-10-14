import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { garments } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { signedGetUrl } from "@/lib/r2";
import { CatalogReview, type CatalogItem } from "./catalog-review";

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
      <p className="text-muted-foreground">
        Your catalog is empty. Import your closet with Claude Code (say <strong>&ldquo;import my closet&rdquo;</strong>), or <Link href="/add" className="underline">add an item by photo</Link>.
      </p>
    );
  }
  return <CatalogReview items={items} />;
}

export default function CatalogPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/add" className="font-medium hover:underline">Add item</Link>
          <Link href="/" className="text-muted-foreground hover:underline">Home</Link>
        </nav>
      </header>
      <Suspense fallback={<p className="text-muted-foreground">Loading your catalog…</p>}>
        <Catalog />
      </Suspense>
    </main>
  );
}
