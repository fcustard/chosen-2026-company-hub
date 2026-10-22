# Master Calendar to Hub sync

The CHOSEN Hub Automation workflow reads the Apps Script `feed=hub-v2` output from the Master Calendar. It publishes the feed's public rehearsal fields and exact-call targets, then builds the Hub.

The Master Calendar's **Phase / Focus** column is an internal planning label. Editing it alone does not change a public Hub field. Update **Public Title**, **Rehearsal Plan**, **Who Is Called**, the public notes, exact targets, or event times as appropriate when the Hub needs to change.

The **Personal Calls** tab contains the reviewed individual report and release times for September 30 and October 1, 3, 7, and 8. Each READY row has a stable Event Key and Person ID. Edit the two time cells when an individual call changes; add a row for each newly called person. Every person in a timed event needs an explicit row.\n\nThe Apps Script web app still needs to read that tab and include `personalCallTimes` and `personalCallEndTimes` in `feed=hub-v2`. The integration helper is in `tools/apps-script-personal-calls.gs`; it attaches complete maps and converts broad group calls to the exact roster in the tab. Add it to the existing bound Apps Script project's hub-v2 response and deploy a new web app version. The guarded merge already accepts complete validated maps. Until that deployment, reviewed Hub windows remain protected and conflicting source changes stop for review.

For an urgent check, run **CHOSEN Hub Automation** from the repository's **Actions** tab using **Run workflow**. Inspect the `Sync exact rehearsal calls from Master Calendar` step and the Pages deployment. GitHub's scheduled runs may be delayed.

## Device calendars

`chosen-calendar.ics` is built from the same approved, normalized public schedule as the Hub. It exports shared windows, location, status, and the 6:00 PM show start; it never exports named calls or individual report/release times. Existing subscription URLs and event UIDs stay fixed. Public changes advance `SEQUENCE` and `LAST-MODIFIED`; unchanged/private-only edits do not. Removed events remain in the feed as `STATUS:CANCELLED` notices, so devices can cancel an event they previously downloaded. Keep the previously published ICS when building; it supplies the revision history.

Some participants connected the older native **CHOSEN 2026 - Rehearsals & Production** Google calendar. That calendar is separate from the Hub ICS subscription and must also be updated. `data/google-calendar-sync.json` records its calendar ID and the verified Event Key to Google event ID mapping. The existing **Check CHOSEN calls** monitor now checks and repairs this Google calendar on each hourly run, including when the Sheets are unchanged. Update the existing event in place and verify readback; preserve attendees and reminder preferences. New approved events require a duplicate check before creation and a mapping update. Only explicit validated cancellations authorize removing mapped Google events. A failed or empty source read never authorizes deleting events.

The native Google mirror and the public subscription use the same shared fields. Google descriptions include the Hub My Calls link and `CHOSEN Event Key: …` marker. They do not include named or personal calls. Label pending windows as tentative. Do not change the historical calendar entries as part of a future-schedule sync.

Google/Apple decide when subscribers' devices fetch changes. `REFRESH-INTERVAL` and `X-PUBLISHED-TTL` request hourly refresh but do not force it. An imported ICS file or copied event is a separate snapshot and cannot be remotely updated. The Schedule page explains how to check the subscribed calendar and replace old copies without touching unrelated personal events. Use the Hub for same-day changes.
