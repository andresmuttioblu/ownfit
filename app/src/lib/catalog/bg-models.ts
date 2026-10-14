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

// Tap-to-select: SlimSAM (Apache-2.0, Xenova/slimsam-77-uniform, quantized). The encoder runs once
// per photo, the decoder once per tap. Pinned to a revision and checked by sha256 on upload.
const SAM_REVISION = "5850ab45f587c112167512ffef949107115e26a0";
export const SAM_MODELS = {
  "slimsam-encoder": {
    url: `https://huggingface.co/Xenova/slimsam-77-uniform/resolve/${SAM_REVISION}/onnx/vision_encoder_quantized.onnx`,
    sha256: "cce23c7b2e5d4f330932738fb67ba518e04b0d99ccdd1cccd22a7da4e01f2971",
  },
  "slimsam-decoder": {
    url: `https://huggingface.co/Xenova/slimsam-77-uniform/resolve/${SAM_REVISION}/onnx/prompt_encoder_mask_decoder_quantized.onnx`,
    sha256: "cb90b279f549d2cab7fd6e20c38522438c65d84bdcca3d2a764cff7d857fdce2",
  },
} as const;

/** Model files the app hands out (models/<name>.onnx in R2). */
export const SERVED_MODELS: readonly string[] = [ACTIVE_BG_MODEL, ...Object.keys(SAM_MODELS)];
