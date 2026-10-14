// Self-host the onnxruntime-web wasm runtime (JS glue + wasm) under public/ort/, so no third-party
// code runs on the app's origin. Runs on install; the files are build output, not committed.
import { copyFileSync, mkdirSync } from "node:fs";

const SRC = "node_modules/onnxruntime-web/dist";
mkdirSync("public/ort", { recursive: true });
for (const file of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  copyFileSync(`${SRC}/${file}`, `public/ort/${file}`);
}
