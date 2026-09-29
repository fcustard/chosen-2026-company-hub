# Master Calendar to Hub sync

The CHOSEN Hub Automation workflow reads the Apps Script `feed=hub-v2` output from the Master Calendar. It publishes the feed's public rehearsal fields and exact-call targets, then builds the Hub.

The Master Calendar's **Phase / Focus** column is an internal planning label. Editing it alone does not change a public Hub field. Update **Public Title**, **Rehearsal Plan**, **Who Is Called**, the public notes, exact targets, or event times as appropriate when the Hub needs to change.

The **Personal Calls** tab contains the reviewed individual report and release times for September 30 and October 1, 3, 7, and 8. Each READY row has a stable Event Key and Person ID. Edit the two time cells when an individual call changes; add a row for each newly called person. Every person in a timed event needs an explicit row.\n\nThe Apps Script web app still needs to read that tab and include `personalCallTimes` and `personalCallEndTimes` in `feed=hub-v2`. The integration helper is in `tools/apps-script-personal-calls.gs`; it attaches complete maps and converts broad group calls to the exact roster in the tab. Add it to the existing bound Apps Script project's hub-v2 response and deploy a new web app version. The guarded merge already accepts complete validated maps. Until that deployment, reviewed Hub windows remain protected and conflicting source changes stop for review.

For an urgent check, run **CHOSEN Hub Automation** from the repository's **Actions** tab using **Run workflow**. Inspect the `Sync exact rehearsal calls from Master Calendar` step and the Pages deployment. GitHub's scheduled runs may be delayed.
