# Wardrobe — AI Wardrobe Catalog & Outfit Assistant

> Working title. Open-source Claude Code skill + self-hosted web app.
> Film your closet once → get a clean, tagged catalog → tap a button each day → get outfits from clothes you actually own.

---

## 0. How to use this document

- This is a **spec-first** build. Claude Code implements one stage at a time.
- Every stage ends with a **STOP GATE**: Claude Code stops, reports what was built, shows evidence (screenshots, sample output, test results), and waits for explicit approval before starting the next stage.
- Never skip a stop gate. Never start a later stage "to save time."
- When something in this spec is ambiguous, ask before building. When a decision is marked **DECISION**, present the options with a recommendation and wait.

---

## 1. Product summary

A two-piece system:

1. **Local import pipeline** (Claude Code skill, runs on the user's computer) — turns a folder of wardrobe video + loose photos into a clean, tagged catalog. Heavy processing lives here.
2. **Hosted app** (Next.js on Vercel, Postgres on Neon) — onboarding, daily outfit buttons, per-piece actions, buy list, fitting room, travel packing, history. Light processing lives here.

**Rule of thumb:** bulk work goes local, incremental work goes online.

### Core principles
- **Truthful catalog.** Owned garments are never AI-generated. Real photo → background removed → white background. Never invent buttons, logos, or details.
- **Pull, not push.** The app never sends unprompted daily suggestions. The user opens it when they need an outfit.
- **Default = everything available.** The user only subtracts, and temporary subtractions reset themselves.
- **Inclusive by design.** Works equally for any wardrobe — menswear, womenswear, mixed. No hard gender switch.
- **Self-hosted & private.** Each user deploys to their own Vercel + Neon. The project author never holds anyone's data.
- **Code filters, model styles.** Deterministic code narrows candidates (weather, occasion, availability); the model only makes the final styling judgment on a small set.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| App | Next.js (App Router), TypeScript, Tailwind, shadcn/ui |
| DB | Neon Postgres + Drizzle ORM |
| Hosting | Vercel |
| Image storage | Vercel Blob (**DECISION**: confirm vs. alternatives) |
| Local pipeline | Python 3.11+, ffmpeg, OpenCV, rembg |
| Vision tagging (local) | Claude Code itself reviews images and writes tags (uses the user's Claude subscription, no API key needed for bulk import) |
| Model calls (hosted app) | Anthropic API (requires user's own API key — see §11) |
| Weather | Open-Meteo (free, no API key — keeps setup zero-config) |
| Single-image background removal (online) | **DECISION**: browser-side (`@imgly/background-removal`, no server cost) vs. hosted model API. Recommendation: browser-side. |

---

## 3. User journey (reference)

### First run
1. Clone repo → run setup in Claude Code ("set up my wardrobe").
2. Claude walks through: install deps → log in to Neon (one browser approval) → log in to Vercel (one browser approval) → it creates the DB, runs migrations, sets env vars, deploys. User never clicks around dashboards.
3. Onboarding in the app (questions, style rounds, activities).
4. Filming instructions → user prepares an import folder.
5. Local import runs with visible progress.
6. **Catalog review** screen — user fixes, merges, deletes, adds.
7. First outfit.

### Daily
- Open app → "What are you doing today?" → tap a button → outfits appear → react per piece → done.

### Occasional
- Add a new purchase (single photo, from phone).
- Fitting room: "should I buy this?"
- Travel packing.
- Review buy list / sell-or-donate list.

---

## 4. Data model (draft — refine in Stage 3)

```
users            id, name, age, style_preference (free-form wardrobe conventions, not a gender switch),
                 created_at

style_profile    user_id, attributes JSONB (weighted traits: palette, fit, silhouette, formality,
                 aesthetics…), sources (onboarding_rounds | reference_images | feedback), updated_at

activities       id, user_id, label (office, outdoors, gym, night out, formal…), sort_order, active

garments         id, user_id, image_url (clean, bg removed), source_image_url (original frame/photo),
                 category (top, bottom, dress, outerwear, shoes, bag, accessory, jewelry…),
                 subcategory, colors[], pattern, material, formality (1–5), seasons[], warmth (1–5),
                 tags[], status (active | retired), source (video | photo | single_add),
                 created_at, retired_at, retire_reason (dislike | no_longer_owned | other)

garment_unavailable   garment_id, date        -- "not today"; only today's date counts, auto-expires

outfits          id, user_id, activity_id | free_text_occasion, weather_snapshot JSONB,
                 garment_ids[], created_at, status (suggested | worn | skipped), rating (+1 | -1 | null)

reference_images id, user_id, image_url, extracted_attributes JSONB, source (onboarding | upload)

style_presets    id, image_url, attributes JSONB   -- curated, shipped with repo, used in onboarding rounds

fitting_room     id, user_id, image_url, tags JSONB, verdict JSONB, created_at  -- sandbox, NOT in catalog

buy_suggestions  id, user_id, item_type (e.g. "mid-weight olive overshirt"), reason, unlocks_count,
                 google_shopping_url, status (open | bought | dismissed), created_at
```

---

## 5. Stages

### STAGE 1 — Repo scaffold & setup skill
**Goal:** a clone-and-run experience.

- Monorepo layout: `/app` (Next.js), `/pipeline` (Python), `/skill` (Claude Code skill: SKILL.md + scripts), `/presets` (onboarding style images + tags), `/docs`.
- Setup skill that, conversationally:
  - checks/installs Python, ffmpeg, Node, pnpm; installs Python deps in a venv.
  - runs `neonctl auth` and `vercel login` (one browser approval each), then creates the Neon project/DB, runs Drizzle migrations, links the Vercel project, sets env vars, deploys.
  - asks for the Anthropic API key and stores it in Vercel env vars only.
- Cross-platform from day one: Mac, Windows, Linux. Use `pathlib`, no shell-specific tricks.
- LICENSE (MIT), `.env.example`, PRIVACY.md stub, README skeleton.

**STOP GATE 1:** show the repo tree, run setup on a clean machine/env, show it deploying an empty app. Wait for approval.

---

### STAGE 2 — Local import pipeline (capture → clean images)
**Goal:** one clean, background-removed image per garment from an import folder.

**Input:** an import folder containing any mix of:
- one or more videos of the user holding each garment up to a tripod camera (pause 2–3 s per item, swap between items);
- loose photos for things that don't film well (accessories, shoes, jewelry, folded items, anything the video missed).

**Steps:**
1. Extract frames from videos with ffmpeg (~2 fps).
2. Score each frame for sharpness (variance of the Laplacian, OpenCV). Drop blurry frames — swap motion between items naturally scores low.
3. Segment into still moments: cluster consecutive sharp frames by timestamp (+ visual similarity as a tiebreaker). One cluster = one garment.
4. Pick the sharpest frame per cluster.
5. Crop to the presented garment (the person is in frame; isolate the held item).
6. Loose photos skip steps 1–4 and enter here.
7. Background removal with rembg → garment on clean white, consistent square canvas.
8. Write output: `/output/<import-id>/items/NNN.png` + `manifest.json` (source file, timestamp, sharpness score, original crop path).
9. Visible progress at every step: "Found 34 items… removing backgrounds 12/34…". Never a silent spinner.

**Testing:** include a small synthetic test set (a short sample video + a few photos) and an automated check that item count matches expected.

**STOP GATE 2:** run on a real sample folder, show a contact sheet of every output image, report item count vs. actual, list misses/duplicates. Tune thresholds with the user. Wait for approval.

---

### STAGE 3 — Catalog tagging + review + upload
**Goal:** a correct, structured catalog in Neon.

1. Tagging: Claude Code views each clean image and writes structured tags (schema in §4) — category, subcategory, colors, pattern, material, formality, seasons, warmth. Vocabulary must cover all wardrobes (dresses, skirts, blouses, heels, bags, jewelry, etc.).
2. Tag only the presented garment, never the person.
3. **Catalog review screen** (in the app — non-negotiable):
   - clean grid, tap a card to fix any tag;
   - merge duplicates, delete bad detections, add missed items by photo;
   - should feel like quick triage, not data entry (bulk edit, keyboard shortcuts on desktop).
4. Upload images to blob storage, insert rows via Drizzle.

**STOP GATE 3:** show the populated catalog, the review screen, and a sample of tags. User reviews accuracy. Wait for approval.

---

### STAGE 4 — Onboarding
**Goal:** a usable taste profile before the first outfit.

1. Light questions: name, age, wardrobe conventions (inclusive preference, not a hard gender binary; mixed allowed).
2. **Style rounds:** 5 rounds × 4 images. User taps the one they prefer. Each preset image carries weighted attributes; each pick adds weight to the profile. (Presets are curated, licensed-for-use images shipped in `/presets` — **DECISION**: image source/licensing.)
3. Optional reference upload: user drops saved images (e.g., from Pinterest/Instagram, saved manually — no link scraping). Same attribute-extraction engine as presets.
4. **Activity tags:** office, outdoors, gym, night out, formal, casual, travel, + custom. These become the daily buttons.
5. Filming instructions screen: exact how-to (phone on a tripod or propped, stand back, hold each piece 2–3 s, swap), with a short example clip, and a checklist for the loose-photos folder.

**STOP GATE 4:** walk through onboarding end to end, show the resulting style_profile JSON. Wait for approval.

---

### STAGE 5 — Daily recommendation flow
**Goal:** two taps to an outfit.

**UI:** "What are you doing today?" → personalized buttons (from activities) + a small "something else" free-text option.

**Engine:**
1. Fetch weather (Open-Meteo) for the user's location.
2. **Code filtering:** active garments only → exclude today's "not today" items → filter by occasion formality range, weather warmth/seasons → enforce completeness (top+bottom or dress, shoes; outerwear if cold; accessories optional) → avoid combos worn in the last N days (outfit history).
3. **Model styling:** send the filtered candidates + style profile + recent feedback + baseline styling rules → model returns 2–3 outfits referencing garment IDs only, each with a one-line why.
4. Validate: every returned ID must exist and be available. Reject anything else.
5. Also return "what you might need today" (e.g., umbrella, a layer for the evening).

**Baseline styling rules** (shipped as an editable `rules.md`/JSON, covering all wardrobes): color harmony, pattern mixing, formality matching, proportion/silhouette balance, fabric by season, weather appropriateness.

**Empty/thin state:** if no good outfit exists, say what's missing and add it to the buy list — never a dead end.

**Speed:** target < 3 s perceived. **DECISION**: optional pre-compute of each activity's options on app open (still pull: no notifications).

**STOP GATE 5:** demo each button with real catalog data, show timings, show the empty state. Wait for approval.

---

### STAGE 6 — Per-piece actions & feedback loop
On every suggested outfit, each piece shows quick actions:

- **Not today** — removes it from today only; auto-resets tomorrow. There is no "mark as clean" step, ever.
- **Retire** — permanent removal. Ask a one-tap reason: don't like it / don't own it anymore. "Don't like it" feeds a negative signal into the style profile and the sell-or-donate list.
- Swap — replace just this piece.

On the outfit: **Wore this** (logs history), thumbs up / down (feeds style profile).

The style profile visibly improves: recent likes/dislikes are injected into the styling prompt; periodically recompute weighted attributes.

**STOP GATE 6:** demo each action, show state resetting the next day (simulate date), show profile changes after feedback. Wait for approval.

---

### STAGE 7 — Single-item add (online)
- From phone: snap/upload one photo → background removal (per §2 decision) → tagging via API → quick confirm screen → added.
- After adding: show "new outfits this unlocks."
- Also used for new purchases.

**STOP GATE 7.**

---

### STAGE 8 — Fitting room ("should I buy this?")
- Upload a photo of an item being considered (store photo, screenshot).
- Tagged into a **sandbox** — never enters the catalog.
- Shows: number of outfits it would create with owned items, example outfits, whether it fills a real gap or duplicates what the user already has ("this is your 5th grey sweater").
- "I bought it" → graduates into the catalog via the Stage 7 flow.

**STOP GATE 8.**

---

### STAGE 9 — Buy list & sell-or-donate list
**Buy list (gap analysis):**
- Compare catalog against activities, seasons, and style profile.
- Suggest item **types** in words ("mid-weight olive overshirt"), with the reason and how many new outfits it would unlock.
- Each suggestion has a **Google Shopping button** — a constructed, URL-encoded search link (`https://www.google.com/search?tbm=shop&q=...`). No scraping, no API, no affiliate links.

**Sell-or-donate list:**
- Items not worn in X months (from outfit history), items retired as "don't like," and heavy duplicates.

**STOP GATE 9.**

---

### STAGE 10 — Travel packing
- Input: days, destination (weather lookup), planned activities.
- Output: a capsule — minimum pieces, maximum combinations, with a day-by-day outfit plan and a packing checklist.

**STOP GATE 10.**

---

### STAGE 11 — Public release polish
- **README:** one-line hook, demo GIF/video near the top (video in → outfits out), screenshots of onboarding/daily/fitting room, numbered setup steps, FAQ, troubleshooting per OS.
- Demo assets: record a real end-to-end clip; generate clean screenshots.
- **Compliance:**
  - LICENSE: MIT.
  - Dependency license audit (ffmpeg build, rembg/model weights, OpenCV, npm packages) — confirm compatibility; document in `THIRD_PARTY_LICENSES.md`.
  - PRIVACY.md: data lives in the user's own Vercel/Neon/Blob; state plainly which steps send images to third parties (Anthropic API for tagging/styling, any hosted bg-removal API) and what is stored where.
  - Onboarding presets: only images we have rights to ship.
  - No scraping of Instagram/Pinterest/Google anywhere.
  - CONTRIBUTING.md, CODE_OF_CONDUCT.md, issue templates.
- Note: not legal advice — get a professional review if the project grows.

**STOP GATE 11:** fresh-machine install test on Mac and Windows following only the README. Wait for approval.

---

## 6. Explicitly out of scope
- Virtual try-on (rendering outfits on the user's body).
- Push notifications / unprompted daily suggestions.
- Live link fetching from Instagram, Pinterest, or Google.
- Retail integrations, affiliate links, product scraping.
- AI-generated images of owned garments.

---

## 7. Open decisions (resolve at the relevant stop gate)
1. Image storage provider (Vercel Blob recommended).
2. Online single-image background removal: browser-side (recommended) vs. hosted API.
3. Pre-computing daily options on open (yes/no).
4. Source and licensing of onboarding preset images.
5. Project name.

## 8. Cost notes
- Local import: free (uses the user's Claude subscription via Claude Code for tagging; ffmpeg/rembg run locally).
- Hosted app: Vercel and Neon free tiers are enough for one user.
- **The deployed app's model calls require an Anthropic API key** (billed per use — a Claude subscription doesn't cover a deployed app). Expect roughly cents per day for one user; keep prompts lean by filtering in code first.
