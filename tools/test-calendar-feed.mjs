import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCalendarFeed } from './calendar-feed.mjs';

const source = JSON.parse(readFileSync(new URL('../data/content.json', import.meta.url), 'utf8'));

test('the feed includes every published schedule event and no private call details', () => {
  const events = source.schedule.allRehearsals;
  const feed = buildCalendarFeed(events, new Date(source.updated));
  const unfolded = feed.replace(/\r\n /g, '');
  assert.equal((feed.match(/BEGIN:VEVENT/g) || []).length, events.length);
  for (const event of events) {
    assert.match(unfolded, new RegExp('UID:' + event.id + '@chosen-2026-company-hub'));
    assert.match(unfolded, new RegExp('DTSTART:' +
      new Date(event.start).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')));
  }
  assert.ok(feed.split('\r\n').every(line => Buffer.byteLength(line, 'utf8') <= 75));
  assert.doesNotMatch(unfolded, /personalCallTimes|personalCallEndTimes|calledPeopleIds|calledGroups/);
  const show = events.find(event => event.id === 'CHOSEN-20261220-SHOW');
  assert.ok(show?.showDay?.showtime);
  assert.ok(unfolded.includes('SUMMARY:CHOSEN 2026 - SHOW DAY (show at ' + show.showDay.showtime + ')'));
  assert.ok(unfolded.includes('DESCRIPTION:Show begins at ' + show.showDay.showtime));
});

test('the same event ID survives a changed time without exporting names', () => {
  const original = {
    id: 'CHOSEN-20261014-REH',
    start: '2026-10-14T22:30:00Z',
    end: '2026-10-15T01:30:00Z',
    title: 'Rehearsal, Scene 1',
    location: 'Faith Center; Sunrise',
    called: 'Jordyn Starks',
    personalCallTimes: { jordyn: '6:30 PM' }
  };
  const first = buildCalendarFeed([original], new Date('2026-10-14T10:00:00Z'));
  const changed = buildCalendarFeed([{ ...original, start: '2026-10-14T23:30:00Z' }], new Date('2026-10-14T11:00:00Z'));
  assert.match(first, /DTSTART:20261014T223000Z/);
  assert.match(changed, /DTSTART:20261014T233000Z/);
  assert.match(first, /UID:CHOSEN-20261014-REH@/);
  assert.match(changed, /UID:CHOSEN-20261014-REH@/);
  assert.doesNotMatch(first + changed, /Jordyn|jordyn/);
  assert.match(first, /SUMMARY:Rehearsal\\, Scene 1/);
  assert.match(first, /LOCATION:Faith Center\\; Sunrise/);
});

test('invalid or duplicate windows stop publication', () => {
  const event = { id:'CHOSEN-20261014-REH', start:'2026-10-14T22:30:00Z',
    end:'2026-10-15T01:30:00Z', title:'Rehearsal', location:'Faith Center' };
  assert.throws(() => buildCalendarFeed([event, event]), /Duplicate/);
  assert.throws(() => buildCalendarFeed([{...event, end:event.start}]), /Invalid/);
  assert.throws(() => buildCalendarFeed([]), /empty/);
});
