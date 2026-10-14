/** A garment image on its white tile. The image already has a white background, so the tile frames it as an object. */
export function GarmentImage({ src, alt = "", className = "" }: { src: string; alt?: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URLs and local object URLs
    <img src={src} alt={alt} className={`aspect-square w-full rounded-xl bg-tile object-contain ${className}`} />
  );
}

/** Placeholder with the shape of what's loading. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-muted motion-reduce:animate-none ${className}`} />;
}
