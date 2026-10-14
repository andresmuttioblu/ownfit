import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ACTIVE_BG_MODEL } from "@/lib/catalog/bg-models";
import { signedGetUrl } from "@/lib/r2";

// Redirects to a short-lived signed URL for the background-removal model in R2.
export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.redirect(await signedGetUrl(`models/${ACTIVE_BG_MODEL}.onnx`), 302);
}
