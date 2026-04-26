# Ops Tasks

Mobile-first ops task app. Reads from a Google Sheet (published CSV), writes back via n8n webhook.

## Local dev

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Deploy to Vercel

**Option A — GitHub + Vercel dashboard (easiest):**

1. `git init && git add . && git commit -m "init"`
2. Push to a GitHub repo
3. In Vercel: New Project → import the repo
4. Vercel auto-detects Vite. Click Deploy.

**Option B — Vercel CLI:**

```bash
npm i -g vercel
vercel
```

Follow the prompts. Subsequent deploys: `vercel --prod`.

## Continuous Integration

This repository includes a GitHub Actions workflow at `.github/workflows/ci.yml`.
It runs on `push` and `pull_request` for `main`, installs dependencies with `npm ci`, and verifies the app builds successfully with `npm run build`.

No environment variables needed. CSV URL and webhook URL are stored in browser localStorage (per device).

## First-time setup after deploy

1. Open the deployed URL on your phone
2. Tap the gear icon
3. Paste your Google Sheet's published CSV URL
4. Paste your n8n webhook URL
5. Save → it auto-syncs

## Add to home screen (iOS / Android)

The app has the right meta tags to install as a PWA-like icon:

- **iOS Safari**: Share → Add to Home Screen
- **Android Chrome**: Menu → Install app / Add to Home Screen

## n8n side

See `ops-tasks-setup.md` for the workflow import + Google Sheet column setup.

## Notes

- `vite.config.js` — standard Vite + React
- `tailwind.config.js` — scans `index.html` and `src/**`
- Fonts (Fraunces + Manrope) load from Google Fonts via `<link>` in `index.html`
- All state persists to localStorage: tasks, csvUrl, webhookUrl, lastSync
- CSV fetch happens automatically on app load if URL is configured

## Known limitations

- **CORS on the CSV URL** — Google's published CSV serves with permissive CORS, so direct fetch from the browser works. If you switch to the Sheets API later, you'll need a backend or n8n proxy.
- **Cache delay** — published CSV updates lag ~5 min behind sheet edits. The app's writes show locally instantly, so this only matters when someone else edits the sheet directly.
- **Single-tenant** — settings are per-browser. If you want multi-user with shared config, swap localStorage for a backend (Supabase, etc.) or hardcode the URLs in `App.jsx`.
