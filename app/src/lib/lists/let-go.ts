// Sell or donate: pieces that may be ready to leave the closet. Pure rules; the page reads the data.

export const NOT_WORN_MONTHS = 12; // a full cycle of seasons, so winter coats aren't flagged in summer
const DUPLICATE_GROUP = 3; // this many of the same type in the same main color
const KEEP_FROM_DUPLICATES = 2;

export type LetGoPiece = {
  id: string; name: string; category: string; subcategory: string; colors: string[];
  status: "active" | "retired" | "deleted"; retireReason: string | null;
  createdAt: Date; keptUntil: string | null; lastWorn: string | null; // YYYY-MM-DD
};
export type LetGoReason = "not_worn" | "disliked" | "duplicate";
export type LetGoItem = { piece: LetGoPiece; reason: LetGoReason };

const monthsBefore = (today: string, months: number) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
};

/** Each piece at most once: disliked first, then not worn lately, then the least-worn extras of big duplicate groups. */
export function letGoList(pieces: LetGoPiece[], today: string): LetGoItem[] {
  const cutoff = monthsBefore(today, NOT_WORN_MONTHS);
  const kept = (p: LetGoPiece) => !!p.keptUntil && p.keptUntil > today;
  const active = pieces.filter((p) => p.status === "active" && !kept(p));
  const items: LetGoItem[] = pieces
    .filter((p) => p.status === "retired" && p.retireReason === "dislike" && !kept(p))
    .map((piece) => ({ piece, reason: "disliked" }));
  for (const p of active) {
    const added = p.createdAt.toISOString().slice(0, 10);
    if (added < cutoff && (!p.lastWorn || p.lastWorn < cutoff)) items.push({ piece: p, reason: "not_worn" });
  }
  const listed = new Set(items.map((i) => i.piece.id));
  const groups = new Map<string, LetGoPiece[]>();
  for (const p of pieces.filter((p) => p.status === "active")) { // kept pieces still count toward their group
    const key = `${p.category}/${p.subcategory}/${p.colors[0]}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  for (const group of groups.values()) {
    if (group.length < DUPLICATE_GROUP) continue;
    const leastWorn = [...group].sort((a, b) => (a.lastWorn ?? "").localeCompare(b.lastWorn ?? "") || +a.createdAt - +b.createdAt);
    for (const p of leastWorn.slice(0, group.length - KEEP_FROM_DUPLICATES)) {
      if (!listed.has(p.id) && !kept(p)) items.push({ piece: p, reason: "duplicate" });
    }
  }
  return items;
}

/** "Keep" hides a piece from this list for the same window. */
export const keepUntil = (today: string) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + NOT_WORN_MONTHS);
  return d.toISOString().slice(0, 10);
};
