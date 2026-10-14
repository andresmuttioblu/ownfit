import type { ReactNode } from "react";

const ORDER = ["dress", "one-piece", "swimwear", "top", "outerwear", "bottom", "shoes", "bag", "accessory", "jewelry"];
const rank = (category: string) => (ORDER.includes(category) ? ORDER.indexOf(category) : ORDER.length);

/** Pieces in the order a flat lay reads: the main garment first, then layers, bottoms, shoes and extras. */
export function flatLayOrder<T extends { category: string }>(pieces: T[]): T[] {
  return [...pieces].sort((a, b) => rank(a.category) - rank(b.category));
}

/** An outfit laid out on its well: the main piece large, the rest beside and below it. */
export function FlatLay<T extends { id: string; category: string }>({ pieces, tile }: { pieces: T[]; tile: (piece: T, isMain: boolean) => ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {flatLayOrder(pieces).map((p, i) => (
        <div key={p.id} className={i === 0 && pieces.length > 2 ? "col-span-2 row-span-2" : ""}>{tile(p, i === 0)}</div>
      ))}
    </div>
  );
}
