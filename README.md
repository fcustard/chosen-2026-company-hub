# CHOSEN 2026 Company Hub V1

Production Team lives at `production.html`. The automation refreshes `data/wardrobe.json` from the **Wardrobe Schedule** tab in the Master Calendar, validates approved fittings against published personal calls, and rebuilds the page from that plan and the current production roster. Failed exports keep the last validated plan, with its source-check timestamp visible. Update classroom staffing and fitting status in the wardrobe tab; do not edit generated `production.html` by hand. Run `node tools/sync-wardrobe.mjs`, `npm run validate`, and `npm run build` when publishing changes locally. Primary navigation changes also belong in `templates/resources-page.html` so regenerated Resources keeps the link.

Upload these files to the ROOT of the existing GitHub repository. Replace files with matching names.

New structure:
- index.html
- this-week.html
- scripts.html
- music.html
- schedule.html
- company.html
- styles.css
- app.js
- content.json
- .nojekyll

Most routine updates happen in content.json.

Important placeholders still needed:
- Absence/Late form URL
- Production Help form URL
- published script Read/PDF URLs
- published music Play/Lyrics URLs
- next rehearsal display

Branding choice:
V1 uses the established CHOSEN navy/gold/ivory and star/light language without a large poster image. A subtle key-art crop can be added later without changing the information architecture.

Security:
GitHub Pages is public. Do not place private contact details, minors' data, passwords, or sensitive notes in the repository.
