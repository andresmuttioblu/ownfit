# Privacy

> Stub — completed in Stage 11. Not legal advice.

Ownfit is self-hosted. Your data lives in **your own** Vercel, Neon and blob storage accounts; the project author never receives it.

What leaves your machine:

| Step | Where data goes |
|---|---|
| Local import (video → clean images) | Nowhere. ffmpeg, OpenCV and rembg run on your computer. |
| Bulk tagging | Images are viewed by Claude Code under your own Claude account. |
| Hosted app (outfits, single adds, fitting room) | Garment images/tags are sent to the Anthropic API with your own key. |
| Weather | Your approximate location is sent to Open-Meteo. |
| Storage | Catalog rows in your Neon database; images in your blob store. |

No scraping, no tracking, no analytics.
