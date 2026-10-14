import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ACTIVE_BG_MODEL, SERVED_MODELS } from "@/lib/catalog/bg-models";
import { signedGetUrl } from "@/lib/r2";

// Redirects to a short-lived signed URL for a model file in R2 (?name=..., default: background removal).
export async function GET(request: Request) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const name = new URL(request.url).searchParams.get("name") ?? ACTIVE_BG_MODEL;
  if (!SERVED_MODELS.includes(name)) return NextResponse.json({ error: "Unknown model" }, { status: 404 });
  return NextResponse.redirect(await signedGetUrl(`models/${name}.onnx`), 302);
}
