// Upload the browser background-removal model(s) to the private R2 bucket (models/<name>.onnx).
// The files come from rembg's own checksum-verified download (run the pipeline once, or:
//   pipeline/.venv/bin/python -c "from rembg import new_session; new_session('<name>')").
// Usage (from app/): pnpm models:upload [name ...]   default: every model in BROWSER_MODELS
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function main(names: string[]) {
  const { putObject } = await import("../src/lib/r2");
  const { BROWSER_MODELS } = await import("../src/lib/catalog/bg-models");
  for (const name of names.length ? names : Object.keys(BROWSER_MODELS)) {
    if (!(name in BROWSER_MODELS)) throw new Error(`Unknown model ${name}; known: ${Object.keys(BROWSER_MODELS).join(", ")}`);
    const file = path.join(os.homedir(), ".rembg", "models", name, `${name}.onnx`);
    if (!existsSync(file)) throw new Error(`${file} not found. Download it with rembg first (see the comment at the top of this script).`);
    console.log(`Uploading ${name} (${Math.round(readFileSync(file).length / 1e6)} MB)...`);
    await putObject(`models/${name}.onnx`, readFileSync(file), "application/octet-stream");
  }
  console.log("Done.");
}

main(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
