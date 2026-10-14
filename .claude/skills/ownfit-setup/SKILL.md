---
name: ownfit-setup
description: First-run setup for the Ownfit app — install tools, create the Neon database, deploy to Vercel. Use when the user says "set up my wardrobe", "set up ownfit", or is running this repo for the first time.
---

# Ownfit setup

Walk the user through setup conversationally. One step at a time; say what you're about to do, run it, report the result in one line. Never ask them to click around a dashboard — the only browser steps are the Neon and Vercel logins.

Run every command from the repo root unless a step says otherwise. Claude Code uses a bash shell on Mac, Linux and Windows (Git Bash), so the commands below work as written on all three. Wherever a command says `python`, use `python3` if `python` isn't found (Debian/Ubuntu ship only `python3`).

**Secrets never enter the conversation.** Any command whose output could contain a connection string or key must be piped through a filter that prints only what you need (ids, names), as below.

## 1. Check tools

Run `python .claude/skills/ownfit-setup/scripts/doctor.py`. If anything is MISSING, show the user the printed install command, run it with their OK, then re-run the doctor until it exits 0.

On Windows, after any `winget install`, the new tool isn't on PATH until Claude Code restarts. Ask the user to restart Claude Code, then say "set up ownfit" again.

## 2. Python pipeline

```bash
python -m venv pipeline/.venv
```

Then install the pipeline into it:
- Mac/Linux: `pipeline/.venv/bin/python -m pip install -e pipeline`
- Windows: `pipeline/.venv/Scripts/python -m pip install -e pipeline`

This downloads OpenCV, rembg and onnxruntime (a few hundred MB). Tell the user it takes a minute.

## 3. App dependencies

```bash
pnpm --dir app install
```

## 4. Database (Neon)

1. `npx -y neonctl auth` opens the browser once. Wait for the user to approve.
2. If `grep -q '^DATABASE_URL=.' app/.env.local` succeeds, skip to step 4.7 (setup is being re-run).
3. Pick the Neon organization. List them (names and ids only, no secrets in this output):
   ```bash
   npx -y neonctl orgs list --output json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>JSON.parse(s).forEach(o=>console.log(o.id, o.name)))"
   ```
   If there's more than one, ask the user which to use. Pass it as `--org-id <org>` below.
4. Reuse an existing `ownfit` project if there is one (fresh clone, second machine):
   ```bash
   npx -y neonctl projects list --org-id <org> --output json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s).find(p=>p.name==='ownfit');console.log(p?p.id:'')})"
   ```
5. If that printed nothing, create the project. The raw output contains the password, so print only the id:
   ```bash
   npx -y neonctl projects create --org-id <org> --name ownfit --output json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).project.id))"
   ```
6. Write the connection string into `app/.env.local` without printing it; fail instead of writing an empty value:
   ```bash
   url=$(npx -y neonctl connection-string --project-id <id>) && [ -n "$url" ] && printf 'DATABASE_URL=%s\n' "$url" > app/.env.local
   ```
7. `pnpm --dir app db:migrate`. There are no tables until Stage 3; this confirms the connection works.

## 5. Deploy (Vercel)

Run these from the **repo root** (the Vercel project builds from `app/` via its Root Directory setting; running vercel inside `app/` then fails with ".../app/app does not exist"). `<project-id>` is the Neon id from step 4.

1. `npx -y vercel login` opens the browser once.
2. Pick the scope. `npx -y vercel teams ls` lists them; if there's more than one, ask the user which (usually their personal Hobby scope). Pass `--scope <scope>` to **every** vercel command below so nothing lands in a work team.
3. `npx -y vercel link --yes --project ownfit --scope <scope>`, then point the project at the app folder: `npx -y vercel api /v9/projects/ownfit -X PATCH -f rootDirectory=app --scope <scope> --silent`. If the link connected the GitHub repo, every PR gets a preview deployment and merging into `main` deploys production.
4. Add the database URL to all three environments. Hold it in a shell variable (piping `neonctl` straight into `vercel` is too slow; vercel sees empty stdin) and never print it:
   ```bash
   V=$(npx -y neonctl connection-string --project-id <project-id> | tr -d '\n') && [ -n "$V" ] && for E in production preview development; do printf '%s' "$V" | npx -y vercel env add DATABASE_URL $E --yes --scope <scope> 2>&1 | grep -iv postgres; done; unset V
   ```
   If a variable already exists (re-run), vercel says so; skip it unless the user wants it replaced (`--force`).
5. Image storage (Cloudflare R2, private bucket):
   1. `npx -y wrangler login` (browser approval once). `npx -y wrangler whoami` shows the account id.
   2. `npx -y wrangler r2 bucket create ownfit-images`. If it fails with code 10042, R2 isn't enabled yet: ask the user to open https://dash.cloudflare.com → **R2 Object Storage** and enable it (free tier; Cloudflare asks for a payment method), then retry.
   3. Add the non-secret values yourself, for production, preview and development, the same way as step 5.4: `R2_ACCOUNT_ID` (from whoami) and `R2_BUCKET` = `ownfit-images`.
   4. The access key can only be created in the dashboard (Cloudflare has no CLI for it). Walk the user through: R2 → **Manage API tokens** → **Create Account API token** → permission **Object Read & Write** → **specific bucket: ownfit-images** → TTL **Forever** → Create. The page shows the keys once.
6. Secrets the user enters themselves. **Never ask them to paste a secret in chat.** Ask them to run each of these in their own terminal from the repo root (not via Claude Code's `!` prompt), pasting the value at the prompt. Production is stored as sensitive; development is what `vercel env pull` brings to their machine:
   ```bash
   npx vercel env add R2_ACCESS_KEY_ID production --sensitive --scope <scope>
   npx vercel env add R2_SECRET_ACCESS_KEY production --sensitive --scope <scope>
   npx vercel env add APP_PASSWORD production --sensitive --scope <scope>
   npx vercel env add ANTHROPIC_API_KEY production --sensitive --scope <scope>
   npx vercel env add R2_ACCESS_KEY_ID development --scope <scope>
   npx vercel env add R2_SECRET_ACCESS_KEY development --scope <scope>
   npx vercel env add APP_PASSWORD development --scope <scope>
   ```
   `APP_PASSWORD` is the app's passcode (the app stays locked until it's set). Recommend a random passphrase of 16+ characters from a password manager: the login only slows guessing, it doesn't rate-limit. The Anthropic key bills the deployed app's model calls (roughly cents per day); a Claude subscription doesn't cover a deployed app.
   Then pull the development values to their machine: `npx -y vercel env pull app/.env.local --yes --scope <scope>` (never print it).
   Generate the session-signing secret yourself; it is never shown to anyone:
   ```bash
   S=$(openssl rand -base64 32 | tr -d '\n'); for E in production preview; do printf '%s' "$S" | npx -y vercel env add AUTH_SECRET $E --sensitive --yes --scope <scope>; done; printf '%s' "$S" | npx -y vercel env add AUTH_SECRET development --yes --scope <scope>; unset S
   ```
7. `pnpm --dir app db:migrate` again so the database has the latest tables.
8. `npx -y vercel deploy --prod --yes --scope <scope>`. Then find the public URL: `npx -y vercel inspect <deployment-url> --scope <scope>` lists aliases; use the short `*.vercel.app` alias (the `-<scope>.vercel.app` ones are behind Vercel login).

## 6. Done

Open the URL (or tell the user to). It asks for the passcode, then shows **What are you doing today?** with a **Set up your style** card. If it says "Database not reachable", re-check step 5.4.

## Re-running

Every step is safe to repeat. If the Neon project or Vercel env var already exists, skip that step instead of creating a duplicate (`vercel env add` refuses duplicates; use `--force` only if the user wants to replace the value).
