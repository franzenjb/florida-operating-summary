# CLAUDE CODE — DEPLOY THIS SITE

You are being handed a **finished, production-ready static website**. Do **not** redesign it, rebuild it in a framework, or change its appearance. Your job is purely operational: **get it onto GitHub and deploy it to Vercel**, then hand the user a live URL they can paste into an ArcGIS Experience Builder Embed widget.

The site is a single self-contained `index.html` (HTML + CSS + vanilla JS, no build step, no dependencies). It is a launcher/menu for American Red Cross Florida regional operations: a search bar plus color-coded categories of links that open in new tabs.

---

## Files in this folder
- `index.html` — the entire app. Serve it as-is.
- `vercel.json` — static-hosting config (clean URLs, no-cache so future edits show immediately).
- `CLAUDE.md` — this file. Do not deploy it (harmless if you do).

---

## What to do

### 0. Confirm prerequisites with the user (once)
This requires two CLI tools, each signed in:
- **GitHub CLI** (`gh`) — check `gh auth status`. If not authed, run `gh auth login` and let the user complete the browser flow.
- **Vercel CLI** (`vercel`) — install with `npm i -g vercel` if missing; check `vercel whoami`. If not authed, run `vercel login`.

If either tool is missing or not signed in, tell the user exactly what to run, then continue once they confirm.

### 1. Create the repo and push
From inside this folder:
```bash
git init
git add index.html vercel.json
git commit -m "Florida Regional Operating Summary — launcher hub"
gh repo create florida-operating-summary --public --source=. --remote=origin --push
```
(Use `--private` instead of `--public` if the user prefers. Pick a different repo name if that one is taken.)

### 2. Deploy to Vercel
```bash
vercel link --yes      # links this folder to a new Vercel project
vercel --prod          # deploys; prints the production URL
```
If `vercel link` prompts for scope/project, accept the defaults (new project, current directory as root). The root directory is this folder — there is no build command and no framework; it is a static site, so accept Vercel's "Other" detection.

### 3. Hand back the result
Report to the user:
- The **GitHub repo URL**.
- The **production Vercel URL** (e.g. `https://florida-operating-summary.vercel.app`). **This is the URL that goes into the Experience Builder Embed widget (Embed by URL).**

Confirm the page loads in a browser and that clicking a tile opens its destination in a **new tab**.

---

## Editing links later (tell the user this)
All links live in one clearly-marked block near the top of `index.html` — search the file for `EDIT YOUR LINKS HERE`. Each tile is:
```js
{ label: "Operating Picture", url: "https://..." },
```
- Replace `url: "#"` placeholders with real destinations.
- Add a tile: add another `{ label, url }` line inside a category's `items`.
- Add a category: copy a whole `{ title, color, items: [...] }` block.

After editing, `git commit` + `git push` — Vercel redeploys automatically (usually within ~30s).

### Current link status
- **Wired and working:** Operating Picture and Situational Awareness (real ArcGIS Experience views), Weather Maps (sample external page), plus public sites under Weather and Community Data (NHC, NWS, SPC, USGS, Drought Monitor, FEMA, Census, ALICE).
- **Placeholders (`url: "#"`):** all other Red Cross internal tools. The user will supply these URLs; until then they harmlessly reopen the menu.

---

## Why iframe embedding works
The site sends no `X-Frame-Options` header and Vercel adds none, so ArcGIS Experience Builder's Embed widget can load it in an iframe. Every tile uses `target="_blank"`, so destinations open in a new browser tab and the menu is never navigated away from — this is the intended behavior; do not change it.

## Do NOT
- Do not convert this to React/Next/Vue or add a build pipeline. It is intentionally a zero-dependency static file.
- Do not restyle, re-layout, or "improve" the design.
- Do not add analytics, tracking, or third-party scripts.
