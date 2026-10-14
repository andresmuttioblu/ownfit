# Ownfit — design system

Source of truth for tokens: `app/src/app/globals.css`. This file explains them.

## Theme
Light by default, dark when the phone is in dark mode (`prefers-color-scheme`). Pure white page; garments sit on a faint grey "well" so their white cutouts read as objects. In dark mode the page goes near-black and garment tiles stay light, because the images are on white.

## Color (OKLCH)
Strategy: monochrome. Black, grey and white only; the garments are the color. Red appears only for real errors.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0 0)` | Page |
| `--foreground` / `--primary` | `oklch(0.16 0 0)` | `oklch(0.97 0 0)` | Text; main action and selection (inverted fill) |
| `--muted` | `oklch(0.965 0 0)` | `oklch(0.2 0 0)` | Wells behind garments, choice rows, quiet fills |
| `--accent` | `oklch(0.935 0 0)` | `oklch(0.26 0 0)` | Hover on muted fills |
| `--muted-foreground` | `oklch(0.46 0 0)` | `oklch(0.72 0 0)` | Secondary text and idle icons (≥4.5:1) |
| `--border` | `oklch(0.905 0 0)` | `oklch(1 0 0 / 12%)` | Hairlines, dashed "add" rows |
| `--tile` | `oklch(1 0 0)` | `oklch(0.96 0 0)` | Garment image tiles |
| `--destructive` (+ `-soft`) | red 27° | lighter red | Errors only. `--success`/`--warning` map to grey on purpose |

## Typography
One family: Instrument Sans (400, 500, 600). Fixed scale: 12 / 14 / 16 / 18 / 22 / 28 px. Headings 600 with `text-wrap: balance`; labels 500; body 400. No display fonts, no uppercase eyebrows.

## Shape and spacing
Radius 12px for controls, 16px for outfit and garment groups, full for chips. Spacing on a 4px grid; screens use 16px side padding and 24px between sections.

## Components
- **Tab bar** (phone): Today · Closet · Add · Fitting · Style. Fixed at the bottom with safe-area padding; current tab in full ink, others grey.
- **Choice rows**: one per row, never a two-column grid. 64px tall, muted fill, icon left, label, chevron right; selected = inverted (black fill). "Add your own" is a dashed row.
- **Garment tile** (`GarmentImage`): white tile, square, `object-contain`. No captions under tiles; names show on tap or in alt text.
- **Outfit**: a flat lay on a muted well (main piece large), one line of reasoning, quiet ghost icon actions (wore, like, dislike). Tapping a piece shows its name and ghost actions.
- **Header pills**: compact state like the weather ("Mild") that opens an inline picker; no permanent control rows.
- **Status**: `Notice` for errors and important info. Don't box ordinary hints; use muted text.
- **Empty states**: a line illustration (`components/illustrations.tsx`), a light, playful title, one sentence on what to do, one button.
- **Loading**: an illustration with gentle motion (swinging hanger) for waits over a second; skeletons for page shells.
- **Icons**: lucide, 1.75 stroke idle, 2.25 when current; always `aria-hidden` with a text label or `aria-label` on the control.

## Motion
150–200 ms, ease-out-quart. Outfits fade and rise 4px in sequence (60 ms apart). `prefers-reduced-motion`: opacity only.
