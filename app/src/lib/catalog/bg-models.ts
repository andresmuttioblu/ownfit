// Background-removal models that run in the browser (onnxruntime-web). Same models and
// preprocessing as rembg in the local pipeline, so online and offline cutouts match.
export type BgModel = { size: number; mean: [number, number, number]; std: [number, number, number]; approxMb: number };

export const BROWSER_MODELS = {
  u2netp: { size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], approxMb: 5 },
  "isnet-general-use": { size: 1024, mean: [0.5, 0.5, 0.5], std: [1, 1, 1], approxMb: 179 },
} satisfies Record<string, BgModel>;

export type BgModelName = keyof typeof BROWSER_MODELS;

// ponytail: picked after comparing both on real garment photos (Stage 3 part 2); switch here.
export const ACTIVE_BG_MODEL: BgModelName = "u2netp";
