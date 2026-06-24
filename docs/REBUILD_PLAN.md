# Florida ROS — Sub-Page Rebuild Plan

**Goal:** replace embedded ArcGIS Experience views (which carry the *old* "return to
menu" button pointing at the old ROS) with native `floridaros.jbf.com` pages that
have our own chrome, correct "← Florida ROS Menu" back link, and the standard map
controls. One page per view under route `/p/<slug>`.

## Why this path
The old "return to menu" lives **inside** each Esri Experience's nav bar (cross-origin
iframe — cannot be removed from outside). Building native pages on the underlying
content removes it entirely.

## Key facts (from the Experience Builder JSON)
Source config: `~/Documents/Codex/2026-06-23/.../work/florida-ros-experience-data.json`
(copied essentials into `data/rebuild-manifest.json`).

- The **44 Experience map views run on just a few web maps**:
  - `fe91c670ab2648b8ad460d6f4fb86689` — **Florida Situation Map** (the operating picture; 8 of 9 map widgets)
  - `ed240ae74ac84d4c8a8142f445e7bd54` — Florida Situation Hurricane
  - `01711fd9064c461d801a88e8af044f70` — Florida Base Map II
  - `b1a35efdaf99488b912d7aaf96ec8f4e` — LOI Commitments
  - + 2 feature services
- ~21 of the other "views" are **standalone ArcGIS dashboards** (no ROS nav chrome) → clean embed.
- Remainder: storymaps, a Vimeo overview video, external public sites (leave as new-tab links).

## Auth (the OAuth flip)
Native pages load **private** web maps directly → they MUST authenticate (unlike the
public Experience embed). Reuses the existing wildcard app — **no new registration**:
- App **"BioMed Map Workbench OAuth"**, client `NOYP9RCgBYrcjtRC`, portal `arc-nhq-gis.maps.arcgis.com`
- Redirect `https://*.jbf.com/oauth-callback.html` (covers `floridaros.jbf.com`)
- Implicit token flow, popup → `oauth-callback.html` relays token via `postMessage`
  (recipe ported from `red-cross-map-base-template`). Sign in once per session.

## Page template (standard, per Jeff's map rules)
- ArcGIS Maps SDK 4.31 via CDN (keeps repo zero-build/static).
- Header: Red Cross mark + view title + "← Florida ROS Menu" (→ `/`).
- Controls: Home + Zoom top-left, Search top-right, ScaleBar bottom-left,
  Basemap **gallery** in Expand bottom-right, Legend top-right.
- `view.popupEnabled = false` — NO default gray popup. Click → formatted card in a
  **retractable + resizable** right side panel (curated fields, names not codes, Title Case).

## Status
| Page | Route | Source | Status |
|------|-------|--------|--------|
| Operating Picture | `/p/operating-picture` | webmap `fe91c670` | **PROOF built — awaiting Jeff's review** |
| (rest of map views) | `/p/…` | mostly `fe91c670` / `ed240ae7` | pending proof approval |
| Dashboard views | `/p/…` | standalone dashboards | pending (clean embed) |
| External / weather public | n/a | external | stay as new-tab links |

## Open data gaps
- Per-view → exact item resolution for all 44 (only the map widgets are mapped so far).
- 3 Power BI tiles share one URL (need distinct real URLs).

## Repo
`~/dev/florida-operating-summary` → `floridaros.jbf.com` (Vercel project `florida-operating-summary`).
Menu B default at `/`, Menu A at `/a/`, rebuilt pages under `/p/`.
