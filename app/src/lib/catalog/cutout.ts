// Browser-side background removal: same model + preprocessing as rembg, same white 1024 canvas
// as the local pipeline (pipeline/ownfit_pipeline/clean.py). Runs on the phone; no server cost.
import * as ort from "onnxruntime-web/wasm";
import { ACTIVE_BG_MODEL, BROWSER_MODELS } from "./bg-models";

const CANVAS = 1024;
const MARGIN = 0.06;
const MAX_INPUT = 1600; // keeps clean PNG + original JPEG under the 4.5 MB request limit
const ALPHA_CUTOFF = 16; // matches clean.py's bbox threshold
const MIN_CUTOUT = 0.01; // a cutout smaller than this share of the photo counts as "found nothing"
ort.env.wasm.wasmPaths = "/ort/"; // self-hosted copy (scripts/copy-ort.mjs)
ort.env.wasm.numThreads = 1; // threads need cross-origin isolation headers

let session: Promise<ort.InferenceSession> | null = null;

function loadSession(): Promise<ort.InferenceSession> {
  session ??= ort.InferenceSession.create("/api/bg-model", { executionProviders: ["wasm"] }).catch((e) => {
    session = null; // let a retry try again
    throw e;
  });
  return session;
}

/** Start the (possibly large) model download early, e.g. when the page opens. */
export function preloadCutoutModel(): void {
  loadSession().catch(() => {}); // surfaced again when cutOut() runs
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.getContext("2d")!.imageSmoothingQuality = "high"; // default "low" aliases on big downscales
  c.width = w;
  c.height = h;
  return c;
}

function toBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), type, quality));
}

function inputTensor(photo: HTMLCanvasElement) {
  const { size, mean, std } = BROWSER_MODELS[ACTIVE_BG_MODEL];
  const small = canvas(size, size);
  small.getContext("2d")!.drawImage(photo, 0, 0, size, size);
  const { data } = small.getContext("2d")!.getImageData(0, 0, size, size);
  let max = 1e-6;
  for (let i = 0; i < data.length; i += 4) max = Math.max(max, data[i], data[i + 1], data[i + 2]);
  const plane = size * size;
  const chw = new Float32Array(3 * plane);
  for (let p = 0; p < plane; p++) {
    for (let c = 0; c < 3; c++) chw[c * plane + p] = (data[p * 4 + c] / max - mean[c]) / std[c];
  }
  return new ort.Tensor("float32", chw, [1, 3, size, size]);
}

function maskCanvas(pred: Float32Array, size: number) {
  let lo = Infinity, hi = -Infinity;
  for (const v of pred) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const range = hi - lo || 1;
  const m = canvas(size, size);
  const img = m.getContext("2d")!.createImageData(size, size);
  for (let p = 0; p < size * size; p++) {
    const a = Math.round(((pred[p] - lo) / range) * 255);
    img.data.set([0, 0, 0, a], p * 4);
  }
  m.getContext("2d")!.putImageData(img, 0, 0);
  return m;
}

export type Cutout = { clean: Blob; original: Blob; isBlank: boolean };

/** Photo file -> garment on a white square (PNG) + the downscaled original (JPEG). */
export async function cutOut(file: File): Promise<Cutout> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_INPUT / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const photo = canvas(w, h);
  photo.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const sess = await loadSession();
  const out = await sess.run({ [sess.inputNames[0]]: inputTensor(photo) });
  const size = BROWSER_MODELS[ACTIVE_BG_MODEL].size;
  const pred = (out[sess.outputNames[0]].data as Float32Array).subarray(0, size * size); // channel 0

  // Photo with the mask as its alpha channel, at full photo size.
  const cut = canvas(w, h);
  const ctx = cut.getContext("2d")!;
  ctx.drawImage(maskCanvas(pred, size), 0, 0, w, h);
  ctx.globalCompositeOperation = "source-in";
  ctx.drawImage(photo, 0, 0);

  // Bounding box of the garment.
  const alpha = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (alpha[(y * w + x) * 4 + 3] > ALPHA_CUTOFF) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  const found = x1 >= x0 && y1 >= y0;
  const bw = found ? x1 - x0 + 1 : w, bh = found ? y1 - y0 + 1 : h;
  const isBlank = !found || bw * bh < MIN_CUTOUT * w * h;

  const inner = CANVAS * (1 - 2 * MARGIN);
  const fit = Math.min(inner / bw, inner / bh);
  const out2 = canvas(CANVAS, CANVAS);
  const o = out2.getContext("2d")!;
  o.fillStyle = "#fff";
  o.fillRect(0, 0, CANVAS, CANVAS);
  o.imageSmoothingQuality = "high";
  o.drawImage(cut, found ? x0 : 0, found ? y0 : 0, bw, bh,
    (CANVAS - bw * fit) / 2, (CANVAS - bh * fit) / 2, bw * fit, bh * fit);

  const result = { clean: await toBlob(out2, "image/png"), original: await toBlob(photo, "image/jpeg", 0.85), isBlank };
  for (const c of [photo, cut, out2]) c.width = c.height = 0; // iOS Safari frees canvas memory late
  return result;
}
