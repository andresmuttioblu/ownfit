# Onboarding style presets

The style rounds (Stage 4) live in [`app/src/lib/style/presets.json`](../app/src/lib/style/presets.json), inside the app so Vercel builds it.

- 5 rounds × 4 styles, each with a menswear and a womenswear photo (40 photos). People who wear both see the sets alternate by round.
- Photos come from [Unsplash](https://unsplash.com) under the [Unsplash License](https://unsplash.com/license). They are **linked, not copied**: no image files are in this repo. Every photo keeps its photographer credit, shown under it in the app.
- Each style carries weights in the shared vocabulary (`app/src/lib/style/style-vocab.json`): archetypes, palette, fit, pattern (0–1 each) and formality (1–5). A pick adds them to the user's style profile.

Changing a photo: use only free-license Unsplash photos (not Unsplash+), keep the `images.unsplash.com/photo-…` URL without a query string, update the credit, and run `pnpm --dir app test` (it checks every entry).
