# Static blocked-site previews

Thumbnails shown on the `/view` launch card when a destination blocks embedding
(X-Frame-Options). **Pre-generated and committed** — no runtime screenshot service.

## Add / refresh a preview
1. Capture (server-side render so the page is fully loaded):
   ```bash
   curl -s --max-time 60 \
     "https://image.thum.io/get/width/1280/crop/800/wait/12/png/<DEST_URL>" -o raw.png
   sips -s format png raw.png --out <slug>.png && sips -z 800 1280 <slug>.png && rm raw.png
   ```
2. Map the host → file in `view.html` (the `PREVIEWS` object).
3. Commit the PNG + the map change.

## Current
| Host | File | Tile |
|------|------|------|
| `apps.usgs.gov` | `usgs-fim.png` | USGS Flood Inundation |
