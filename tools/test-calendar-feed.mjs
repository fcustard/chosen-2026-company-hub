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

const sample = { id:'CHOSEN-20261022-REH', start:'2026-10-22T22:30:00Z',
  end:'2026-10-23T01:30:00Z', title:'Rehearsal', location:'Faith Center' };
const firstStamp = new Date('2026-10-22T10:00:00Z');
const nextStamp = new Date('2026-10-22T11:00:00Z');

test('unchanged events keep their revision even across builds and private call changes', () => {
  const first = buildCalendarFeed([sample], firstStamp);
  const next = buildCalendarFeed([{...sample, personalCallTimes:{ jordyn:'8:00 PM' }}], nextStamp, first);
  assert.equal(next, first);
  assert.match(next, /LAST-MODIFIED:20261022T100000Z/);
  assert.match(next, /SEQUENCE:0/);
});

test('public time, location and title changes advance the same event revision', () => {
  let feed = buildCalendarFeed([sample], firstStamp);
  let event = {...sample};
  for (const [index, change] of [
    {start:'2026-10-22T23:30:00Z'}, {location:'Studio'}, {title:'Updated rehearsal'}
  ].entries()) {
    event = {...event, ...change};
    feed = buildCalendarFeed([event], nextStamp, feed);
    assert.match(feed, new RegExp('SEQUENCE:' + (index + 1)));
    assert.match(feed, /UID:CHOSEN-20261022-REH@/);
    assert.match(feed, /LAST-MODIFIED:20261022T110000Z/);
  }
});

test('removal publishes a persistent cancellation and reactivation advances its revision', () => {
  const other = {...sample, id:'CHOSEN-20261024-REH'};
  const first = buildCalendarFeed([sample, other], firstStamp);
  const canceled = buildCalendarFeed([other], nextStamp, first);
  const blocks = canceled.replace(/\r\n /g, '').split('BEGIN:VEVENT');
  const removed = blocks.find(block => block.includes('UID:' + sample.id));
  assert.match(removed, /STATUS:CANCELLED/);
  assert.match(removed, /SEQUENCE:1/);
  assert.match(removed, /SUMMARY:Canceled — Rehearsal/);
  assert.equal(buildCalendarFeed([other], new Date('2026-10-22T12:00:00Z'), canceled), canceled);
  const restored = buildCalendarFeed([sample, other], nextStamp, canceled);
  const restoredBlock = restored.split('BEGIN:VEVENT').find(block => block.includes('UID:' + sample.id));
  assert.match(restoredBlock, /STATUS:CONFIRMED/);
  assert.match(restoredBlock, /SEQUENCE:2/);
});

test('existing feeds without revision fields migrate without changing identities', () => {
  const legacy = buildCalendarFeed([sample], firstStamp)
    .replace(/^LAST-MODIFIED:.*\r\n/gm, '').replace(/^SEQUENCE:.*\r\n/gm, '');
  const next = buildCalendarFeed([sample], nextStamp, legacy);
  assert.match(next, /DTSTAMP:20261022T100000Z/);
  assert.match(next, /LAST-MODIFIED:20261022T100000Z/);
  assert.match(next, /SEQUENCE:0/);
});
