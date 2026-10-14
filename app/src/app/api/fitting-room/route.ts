// Fitting room: tag a shop photo and compare it with the closet. The image is analysed and dropped: never stored.
import { NextResponse } from "next/server";
import { activeCloset } from "@/app/_today/closet";
import { currentUser } from "@/db/user";
import { requireAuth } from "@/lib/auth";
import { tagGarmentImage } from "@/lib/catalog/tag-image";
import { assess, CANDIDATE_ID } from "@/lib/outfits/fitting";
import STYLE_VOCAB from "@/lib/style/style-vocab.json";
import { hourlyLimiter, JPEG, readImage } from "@/lib/upload";

const overLimit = hourlyLimiter(30);

export async function POST(request: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Your session expired. Sign in again." }, { status: 401 });
  }
  if (overLimit()) return NextResponse.json({ error: "That's a lot of items in an hour. Try again later." }, { status: 429 });
  let image: Uint8Array;
  try {
    image = await readImage(await request.formData(), "image", JPEG);
  } catch (e) {
    console.warn("fitting room image rejected", e);
    return NextResponse.json({ error: "That image couldn't be read. Try another one." }, { status: 400 });
  }
  try {
    const tagged = await tagGarmentImage(Buffer.from(image).toString("base64"), "shop");
    if (!tagged.ok) return NextResponse.json({ error: tagged.error }, { status: 502 });
    const user = await currentUser();
    const closet = await activeCloset(user.id);
    const activities = user.activities.length ? user.activities : STYLE_VOCAB.activities;
    const assessment = assess(closet, { ...tagged.tags, id: CANDIDATE_ID }, activities);
    return NextResponse.json({ tags: tagged.tags, notGarment: tagged.notGarment, ...assessment });
  } catch (e) {
    console.error("fitting room failed", e);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
