// Reads the style of one inspiration image for onboarding. The image is analysed and dropped: never stored.
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { tagStyleImage } from "@/lib/style/tag-style";
import { hourlyLimiter, JPEG, readImage } from "@/lib/upload";

const overLimit = hourlyLimiter(30);

export async function POST(request: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Your session expired. Sign in again." }, { status: 401 });
  }
  if (overLimit()) return NextResponse.json({ error: "That's a lot of images in an hour. Try again later." }, { status: 429 });
  let image: Uint8Array;
  try {
    image = await readImage(await request.formData(), "image", JPEG);
  } catch (e) {
    console.warn("reference rejected", e);
    return NextResponse.json({ error: "That image couldn't be read. Try another one." }, { status: 400 });
  }
  const result = await tagStyleImage(Buffer.from(image).toString("base64"));
  return result.ok
    ? NextResponse.json({ weights: result.weights, noOutfit: result.noOutfit })
    : NextResponse.json({ error: result.error }, { status: 502 });
}
