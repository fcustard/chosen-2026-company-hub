# Master Calendar to Hub sync

The CHOSEN Hub Automation workflow reads the Apps Script `feed=hub-v2` output from the Master Calendar. It publishes the feed's public rehearsal fields and exact-call targets, then builds the Hub.

The Master Calendar's **Phase / Focus** column is an internal planning label. Editing it alone does not change a public Hub field. Update **Public Title**, **Rehearsal Plan**, **Who Is Called**, the public notes, exact targets, or event times as appropriate when the Hub needs to change.

The feed currently has no individual report and release time fields. The Hub has reviewed per-person call windows for some rehearsals; the guarded merge preserves those windows and stops on a conflicting edit to the call list or event time. To make individual times fully automatic, extend the Apps Script feed with per-person start/end times and update this sync adapter after testing it against the Hub's person IDs.

For an urgent check, run **CHOSEN Hub Automation** from the repository's **Actions** tab using **Run workflow**. Inspect the `Sync exact rehearsal calls from Master Calendar` step and the Pages deployment. GitHub's scheduled runs may be delayed.
