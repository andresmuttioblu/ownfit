// Line illustrations in the icon style (1.5 stroke, currentColor). Decorative: always aria-hidden.

/** A hanger that swings gently while something is being put together; still under reduced motion. */
export function SwingingHanger({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 72" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <line x1="8" y1="6" x2="88" y2="6" strokeOpacity={0.35} />
      <g className="origin-[48px_6px] animate-[swing_1.8s_ease-in-out_infinite] motion-reduce:animate-none">
        <path d="M48 6v4a5 5 0 1 1-5-5" />
        <path d="M48 14 14 40a3 3 0 0 0 2 5h64a3 3 0 0 0 2-5L48 14" />
        <path d="M24 45v14a4 4 0 0 0 4 4h40a4 4 0 0 0 4-4V45" strokeOpacity={0.45} strokeDasharray="3 4" />
      </g>
    </svg>
  );
}

/** An empty hanger: something's missing from the closet. */
export function EmptyHanger({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M48 8v4a5 5 0 1 1-5-5" />
      <path d="M48 16 14 42a3 3 0 0 0 2 5h64a3 3 0 0 0 2-5L48 16" />
      <path d="M40 56h16" strokeOpacity={0.35} />
      <path d="M30 60h36" strokeOpacity={0.2} />
    </svg>
  );
}

/** A clothes rail with empty hangers: an empty closet or list. */
export function EmptyRail({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 72" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M10 10h100M14 10v58M106 10v58" />
      {[34, 60, 86].map((x, i) => (
        <g key={x} className="origin-top animate-[swing_2.4s_ease-in-out_infinite] motion-reduce:animate-none" style={{ transformOrigin: `${x}px 10px`, animationDelay: `${i * -0.6}s` }}>
          <path d={`M${x} 10v3a3 3 0 1 1-3-3`} />
          <path d={`M${x} 16 ${x - 12} 26a1.5 1.5 0 0 0 1 3h22a1.5 1.5 0 0 0 1-3L${x} 16`} />
        </g>
      ))}
    </svg>
  );
}

/** A price tag with a question mark: "should I buy this?". */
export function QuestionTag({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 72" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M30 14h30l16 16v26a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z" transform="rotate(-8 48 36)" />
      <circle cx="40" cy="24" r="2.5" transform="rotate(-8 48 36)" />
      <path d="M46 36a5 5 0 1 1 6 5c-1.5.5-2 1.5-2 3" />
      <circle cx="50" cy="50" r="0.75" fill="currentColor" />
      <path d="M36 22C28 16 22 8 14 6" strokeDasharray="2 4" strokeOpacity={0.5} />
    </svg>
  );
}

/** A camera over a folded shirt: take a photo of one item. */
export function CameraShirt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 72" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M22 20h12l4-6h20l4 6h12a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4Z" />
      <path d="M40 33l4-3h8l4 3 4 3-3 4-3-2v10H42V38l-3 2-3-4 4-3Z" />
      <circle cx="70" cy="27" r="1" fill="currentColor" />
    </svg>
  );
}
