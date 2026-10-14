// Receives one photo already cut out in the browser, stores it privately, and asks Claude for tags.
// Nothing enters the catalog until the user confirms (see app/add/actions.ts).
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { tagGarmentImage } from "@/lib/catalog/tag-image";
import { deleteObject, putObject, signedGetUrl } from "@/lib/r2";
import { hourlyLimiter, JPEG, PNG, readImage } from "@/lib/upload";

const CLEAN_SIDE = 1024; // the browser always sends a 1024x1024 cutout
const overLimit = hourlyLimiter(60);

function pngSize(bytes: Uint8Array): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)]; // IHDR width/height, big-endian
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
