// Upload a tagged import (output/<id>/ with manifest.json + tags.json) to R2 + Neon.
// Usage (from app/): pnpm catalog:upload ../output/<import-id>
// Safe to re-run: items already uploaded (same import id + item id) are skipped.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { GarmentTags } from "../src/lib/catalog/vocabulary";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

type ManifestItem = { id: string; image: string | null; crop: string; kind: "video" | "photo"; needs_review: boolean };
type Manifest = { import_id: string; items: ManifestItem[] };
const REQUIRED = ["name", "category", "subcategory", "colors", "pattern", "material", "formality", "warmth", "seasons", "tags"];
type TagRecord = { id: string; skip?: string } & Record<string, unknown>;

const SAFE_ID = /^[\w-]+$/; // ids become R2 keys and file names

function inside(dir: string, rel: string): boolean {
  return path.resolve(dir, rel).startsWith(dir + path.sep);
}

function readJson<T>(file: string): T {
  if (!existsSync(file)) throw new Error(`${file} not found`);
  return JSON.parse(readFileSync(file, "utf-8")) as T;
}

async function main(dir: string) {
  // Imported after env loading so the DB client sees DATABASE_URL.
  const { db } = await import("../src/db");
  const { garments } = await import("../src/db/schema");
  const { currentUser } = await import("../src/db/user");
  const { putObject } = await import("../src/lib/r2");
  const { validateTags } = await import("../src/lib/catalog/vocabulary");
  const { and, eq } = await import("drizzle-orm");

  const manifest = readJson<Manifest>(path.join(dir, "manifest.json"));
  if (!SAFE_ID.test(manifest.import_id)) throw new Error(`Unexpected import id: ${manifest.import_id}`);
  const tags = new Map(readJson<TagRecord[]>(path.join(dir, "tags.json")).map((t) => [t.id, t]));

  const user = await currentUser();

  let uploaded = 0, skipped = 0;
  const failed: string[] = [];
  const items = manifest.items.filter((i) => i.image);
  for (const [n, item] of items.entries()) {
    const tag = tags.get(item.id);
    const label = `${n + 1}/${items.length} (item ${item.id})`;
    if (!SAFE_ID.test(item.id) || !inside(dir, item.image!) || !inside(dir, item.crop)) {
      failed.push(`${item.id}: unexpected id or file path in manifest`);
      continue;
    }
    if (!tag || tag.skip) {
      console.log(`Skipping ${label}: ${tag?.skip ?? "not tagged"}`);
      skipped++;
      continue;
    }
    const t = tag as unknown as GarmentTags; // shape checked by REQUIRED + validateTags
    let errors: string[];
    try {
      errors = [...REQUIRED.filter((k) => tag[k] === undefined).map((k) => `missing ${k}`), ...validateTags(t)];
    } catch (e) {
      errors = [`malformed tag: ${(e as Error).message}`];
    }
    if (errors.length) {
      failed.push(`${item.id}: ${errors.join("; ")}`);
      continue;
    }
    const [already] = await db.select({ id: garments.id }).from(garments)
      .where(and(eq(garments.importId, manifest.import_id), eq(garments.importItemId, item.id)));
    if (already) {
      skipped++;
      continue;
    }
    console.log(`Uploading ${label}...`);
    try {
      const imageKey = `garments/${manifest.import_id}/${item.id}.png`;
      const sourceKey = `sources/${manifest.import_id}/${item.id}.jpg`;
      await putObject(imageKey, readFileSync(path.join(dir, item.image!)), "image/png");
      await putObject(sourceKey, readFileSync(path.join(dir, item.crop)), "image/jpeg");
      await db.insert(garments).values({
        userId: user.id, name: t.name, imageKey, sourceImageKey: sourceKey,
        category: t.category, subcategory: t.subcategory, colors: t.colors, pattern: t.pattern, material: t.material,
        formality: t.formality, warmth: t.warmth, seasons: t.seasons, tags: t.tags,
        source: item.kind, needsReview: item.needs_review, importId: manifest.import_id, importItemId: item.id,
      });
      uploaded++;
    } catch (e) {
      failed.push(`${item.id}: ${(e as Error).message}`);
    }
  }
  console.log(`Done: ${uploaded} uploaded, ${skipped} skipped, ${failed.length} failed.`);
  failed.forEach((f) => console.log(`  ${f}`));
  if (failed.length) process.exitCode = 1;
}

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: pnpm catalog:upload <output/import-id>");
  process.exit(1);
}
main(path.resolve(dir)).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
