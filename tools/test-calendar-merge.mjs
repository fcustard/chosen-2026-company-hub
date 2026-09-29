import assert from 'node:assert/strict';
import { createCalendarBaseline, mergeCalendarRehearsals } from './calendar-merge.mjs';

const source = [{
  id: 'CHOSEN-EXAMPLE',
  eventKey: 'CHOSEN-EXAMPLE',
  start: 'Dec 20, 2026 1:00 PM',
  end: 'Dec 20, 2026 8:00 PM',
  title: 'Show Day',
  called: '1:00 PM — Crew',
  calledPeopleIds: ['P-crew'],
  calledGroups: [],
  exactCallStatus: 'READY',
  callDataVersion: 3
}];
const baseline = createCalendarBaseline(source);
const reviewed = [{
  ...source[0],
  start: '2026-12-20T13:00:00-05:00',
  end: '2026-12-20T20:00:00-05:00',
  called: '1:00 PM — Crew\n3:00 PM — Company',
  personalCallTimes: { 'P-crew': '1:00 PM' },
  personalCallEndTimes: { 'P-crew': '8:00 PM' },
  showDay: { showtime: '6:00 PM' }
}];

const titleEdit = [{ ...source[0], title: 'Show Day — revised' }];
const updated = mergeCalendarRehearsals(titleEdit, reviewed, baseline);
assert.equal(updated.rehearsals[0].title, 'Show Day — revised');
assert.equal(updated.rehearsals[0].called, reviewed[0].called);
assert.deepEqual(updated.rehearsals[0].personalCallTimes, reviewed[0].personalCallTimes);
assert.deepEqual(updated.rehearsals[0].showDay, reviewed[0].showDay);

assert.throws(
  () => mergeCalendarRehearsals(
    [{ ...source[0], called: '2:00 PM — Crew' }],
    reviewed,
    baseline
  ),
  /reviewed Hub override/
);
assert.throws(
  () => mergeCalendarRehearsals(
    [{ ...source[0], calledPeopleIds: ['P-other'] }],
    [{ ...source[0], personalCallTimes: { 'P-crew': '1:00 PM' } }],
    baseline
  ),
  /personal report\/release times need review/
);
assert.throws(
  () => mergeCalendarRehearsals(
    [{ ...source[0], start: 'Dec 20, 2026 2:00 PM' }],
    reviewed,
    baseline
  ),
  /personal report\/release times need review/
);
assert.throws(
  () => mergeCalendarRehearsals([], reviewed, baseline),
  /disappeared from the Master Calendar feed/
);

// A complete source time map can adopt matching reviewed windows, then
// subsequent edits to those source times and calls can publish together.
const withWindows = [{
  ...source[0],
  personalCallTimes: { 'P-crew': '1:00 PM' },
  personalCallEndTimes: { 'P-crew': '8:00 PM' }
}];
const adopted = mergeCalendarRehearsals(withWindows, [withWindows[0]], baseline);
assert.ok(adopted.baseline.events['CHOSEN-EXAMPLE'].personalCallTimes);
const later = [{
  ...withWindows[0],
  called: '2:00 PM — Crew',
  personalCallTimes: { 'P-crew': '2:00 PM' }
}];
const published = mergeCalendarRehearsals(later, adopted.rehearsals, adopted.baseline);
assert.equal(published.rehearsals[0].personalCallTimes['P-crew'], '2:00 PM');
assert.equal(published.rehearsals[0].called, '2:00 PM — Crew');
assert.throws(
  () => mergeCalendarRehearsals([{ ...withWindows[0], personalCallEndTimes: undefined }],
    adopted.rehearsals, adopted.baseline),
  /complete exact roster|invalid personal report/
);
assert.throws(
  () => mergeCalendarRehearsals([source[0]], adopted.rehearsals, adopted.baseline),
  /stopped providing personal times/
);
assert.throws(
  () => mergeCalendarRehearsals([{ ...withWindows[0], calledGroups: ['Dancers'] }],
    adopted.rehearsals, adopted.baseline),
  /complete exact roster with no broad called groups/
);
console.log('Guarded calendar merge verified.');
