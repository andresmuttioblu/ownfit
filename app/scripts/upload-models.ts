// Upload the browser models to the private R2 bucket (models/<name>.onnx).
// Background removal: from rembg's own checksum-verified download (run the pipeline once, or:
//   pipeline/.venv/bin/python -c "from rembg import new_session; new_session('<name>')").
// Tap-to-select (SlimSAM): downloaded from a pinned Hugging Face revision and checked by sha256.
// Usage (from app/): pnpm models:upload [name ...]   default: every model
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

function fromRembg(name: string): Uint8Array {
  const file = path.join(os.homedir(), ".rembg", "models", name, `${name}.onnx`);
  if (!existsSync(file)) throw new Error(`${file} not found. Download it with rembg first (see the comment at the top of this script).`);
  return readFileSync(file);
}

async function download({ url, sha256 }: { url: string; sha256: string }): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== sha256) throw new Error(`Checksum mismatch for ${url}: got ${actual}`);
  return bytes;
}

async function main(names: string[]) {
  const { putObject } = await import("../src/lib/r2");
  const { BROWSER_MODELS, SAM_MODELS } = await import("../src/lib/catalog/bg-models");
  const known = [...Object.keys(BROWSER_MODELS), ...Object.keys(SAM_MODELS)];
  for (const name of names.length ? names : known) {
    if (!known.includes(name)) throw new Error(`Unknown model ${name}; known: ${known.join(", ")}`);
    const bytes = name in SAM_MODELS ? await download(SAM_MODELS[name as keyof typeof SAM_MODELS]) : fromRembg(name);
    console.log(`Uploading ${name} (${Math.round(bytes.length / 1e6)} MB)...`);
    await putObject(`models/${name}.onnx`, bytes, "application/octet-stream");
  }
  console.log("Done.");
}

main(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
