# CHOSEN 2026 Company Hub V1

Personal preparation checkboxes are saved only on the current device, separately for each person and rehearsal. They acknowledge reviewed instructions and materials, and do not report attendance or notify production. Changed call instructions clear the call and packing checks; changed script content hashes clear the script check; changed track URLs clear the track check. The content generator copies each approved scene's stable content hash into the script payload, so routine sync timestamps do not erase progress. Pending personal assignments do not get a checklist. Browser-storage failures keep the current visit usable and clearly explain that progress cannot be saved.

Lines & Cue Practice now offers All cards, Need work, and Not marked yet within the chosen role and scene. Marking a reviewed cue as known removes it from Need work, updates the totals, and keeps keyboard focus in the practice flow. Empty views return to All cards without deleting marks. Existing line-progress keys and migration stay intact. Run `npm run validate:preparation` for preparation persistence and filtered-practice behavior checks.

The October 30 flow update puts My Calls first in a shared navigation, adds My/All views for assigned scripts and tracks, and connects each scene reader to spoken-cue practice and its approved music. Returning visitors get a compact personal plan. `tools/navigation.mjs` owns the menu; `npm run build:navigation` applies it after page generation. Scene-reader action links are inserted by `scene-actions.js` and preserved by the scene generator.

Event confirmation and personal assignment publication are separate labels. REVIEW/PENDING/HOLD records stay visible in the full schedule and never create an individual call. Production now shows upcoming planning separately from historical fitting plans and milestone dates. A dated source note older than seven days asks for review; neither a past date nor a source snapshot timestamp proves completion. Update actual production status and appointments in the source wardrobe tab.

`data/updates.json` contains verified, dated homepage updates. Entries require `published: true`, `publishedAt`, and `expiresAt`; optional `scenes` targets the selected member's assigned scenes. Expired, future, unpublished, and unrelated entries are hidden. Run `npm run validate:home` and `npm run validate:flow` for the 28 targeted selection, publication, date, navigation, and preparation-flow checks.

Home now lets a company member choose their name, see their next confirmed call, and open approved material for their assigned scenes. Home and My Calls share `personal-calls.js`; exact call records marked REVIEW never fall back to broad role text. Missing personal times remain clearly labeled as an overall rehearsal window. The remembered selection uses the existing device-local person key, including legacy ID migration and family-member switching. Run `node --test tools/test-home-dashboard.mjs` to check call matching, selection, missing-time warnings, show-day calls, and publication filtering. Homepage presentation lives in `home-dashboard.css` and `home-dashboard.js`; rehearsal and roster data remain owned by the existing feeds.

Master Script sync retries temporary timeouts, network failures, HTTP 408/429, and server errors up to three times, with a 60-second deadline per request (including the response body) and 2/4-second backoff. Direct `publish-script` requests still fail if a fresh valid feed cannot be fetched; they never report the previous scripts as a successful update. Routine runs may retain the existing complete set of 12 scenes after exhausted transport retries. Authorization errors and malformed feed content stop publishing immediately. Run `node --test tools/test-script-feed.mjs` to verify retries and preservation safeguards.

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

