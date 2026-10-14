// Receives one photo already cut out in the browser, stores it privately, and asks Claude for tags.
// Nothing enters the catalog until the user confirms (see app/add/actions.ts).
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { tagGarmentImage } from "@/lib/catalog/tag-image";
import { deleteObject, putObject, signedGetUrl } from "@/lib/r2";

const MAX_BYTES = 3_700_000; // base64 of this stays under Anthropic's 5 MB image limit; the client sends ~1 MB
const CLEAN_SIDE = 1024; // the browser always sends a 1024x1024 cutout
const MAX_DRAFTS_PER_HOUR = 60;
// ponytail: per-instance limiter (serverless instances don't share it); the real cap is the
// Anthropic workspace spend limit. Upgrade to a DB-backed counter if this ever matters.
const recent: number[] = [];

function overLimit(): boolean {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  while (recent.length && recent[0] < hourAgo) recent.shift();
  if (recent.length >= MAX_DRAFTS_PER_HOUR) return true;
  recent.push(Date.now());
  return false;
}

function pngSize(bytes: Uint8Array): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)]; // IHDR width/height, big-endian
}
const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, magic: number[]) {
  return magic.every((b, i) => bytes[i] === b);
}

async function readImage(form: FormData, field: string, magic: number[]): Promise<Uint8Array> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) throw new Error(`${field}: missing or too large`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!startsWith(bytes, magic)) throw new Error(`${field}: unexpected file type`);
  return bytes;
}

export async function POST(request: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Your session expired. Sign in again." }, { status: 401 });
  }
  if (overLimit()) return NextResponse.json({ error: "That's a lot of photos in an hour. Try again later." }, { status: 429 });
  let clean: Uint8Array, original: Uint8Array;
  try {
    const form = await request.formData();
    clean = await readImage(form, "clean", PNG);
    original = await readImage(form, "original", JPEG);
    if (clean.length < 24 || pngSize(clean).some((side) => side !== CLEAN_SIDE)) throw new Error("clean: unexpected dimensions");
  } catch (e) {
    console.warn("draft rejected", e);
    return NextResponse.json({ error: "That image couldn't be read. Try another photo." }, { status: 400 });
  }
  const draftId = crypto.randomUUID();
  try {
    await putObject(`garments/single/${draftId}.png`, clean, "image/png");
    await putObject(`sources/single/${draftId}.jpg`, original, "image/jpeg");
  } catch (e) {
    console.error("draft upload failed", e);
    await deleteObject(`garments/single/${draftId}.png`).catch(() => {}); // the first put may have landed
    return NextResponse.json({ error: "Saving the photo failed. Try again." }, { status: 502 });
  }
  const tagged = await tagGarmentImage(Buffer.from(clean).toString("base64"));
  return NextResponse.json({
    draftId,
    imageUrl: await signedGetUrl(`garments/single/${draftId}.png`),
    ...(tagged.ok ? { tags: tagged.tags, notGarment: tagged.notGarment } : { tagError: tagged.error }),
  });
}
