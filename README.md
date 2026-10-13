# Ownfit

Film your closet once → get a clean, tagged catalog → tap a button each day → get outfits from clothes you actually own.

> Work in progress. See [SPEC.md](SPEC.md) for the plan.

An open-source Claude Code skill + self-hosted web app (Next.js on Vercel, Postgres on Neon). Your data stays in your own accounts.

## Setup

1. Install [Claude Code](https://claude.com/claude-code).
2. Clone this repo and open it in Claude Code.
3. Say **"set up ownfit"** (or "set up my wardrobe"). Claude checks your tools, creates your database, and deploys the app. You'll approve two browser logins (Neon and Vercel).

Works on Mac, Windows and Linux.

## Repo layout

| Path | What |
|---|---|
| `app/` | Next.js web app |
| `pipeline/` | Local Python import pipeline (video/photos → clean garment images) |
| `.claude/skills/` | Claude Code skills (setup now; import later) |
| `presets/` | Onboarding style images |
| `docs/` | Docs |

## License

MIT — see [LICENSE](LICENSE). Privacy: [PRIVACY.md](PRIVACY.md).
