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

Run these from `app/`:

1. `npx -y vercel login` — browser approval once.
2. `npx -y vercel link --yes --project ownfit`
3. Add the database URL for production and preview, reading it from the file so it never appears on the command line:
   ```bash
   grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '\n' > .dburl.tmp
   npx -y vercel env add DATABASE_URL production --sensitive < .dburl.tmp
   npx -y vercel env add DATABASE_URL preview --sensitive < .dburl.tmp
   rm .dburl.tmp
   ```
4. Anthropic API key (needed from Stage 5 on; the user may skip it for now). **Don't ask them to paste it in chat.** Ask them to run this themselves in their own terminal, from `app/`, and paste the key at the prompt:
   ```bash
   npx vercel env add ANTHROPIC_API_KEY production --sensitive
   ```
   Explain: the deployed app bills model calls to this key (roughly cents per day); a Claude subscription doesn't cover a deployed app.
5. `npx -y vercel deploy --prod` — report the production URL.

## 6. Done

Open the URL (or tell the user to). The page should say **Ownfit is set up** and **Database: connected**. If it says "not reachable", re-check step 5.3.

## Re-running

Every step is safe to repeat. If the Neon project or Vercel env var already exists, skip that step instead of creating a duplicate (`vercel env add` refuses duplicates; use `--force` only if the user wants to replace the value).
