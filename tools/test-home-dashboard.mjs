import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findPerson, personMatchesCall, upcomingPublishedCalls, personalCallSummary } from '../personal-calls.js';
import { callScenes, preparationForCall, homeCallState, initHomeDashboard } from '../home-dashboard.js';

const person = { id: 'mary', name: 'Mary André', groups: ['Principals/Featured'], scenes: [3, 8] };
const now = new Date('2026-10-30T16:00:00Z');
const call = { id: 'next', title: 'Scenes 3 & 8 rehearsal', status: 'CONFIRMED',
  start: '2026-10-31T14:00:00Z', end: '2026-10-31T18:00:00Z', time: '10:00 AM–2:00 PM',
  exactCallStatus: 'READY', calledPeopleIds: ['P-mary'], calledGroups: [],
  personalCallTimes: { 'P-mary': '11:00 AM' }, personalCallEndTimes: { 'P-mary': '1:00 PM' },
  location: 'The Faith Center', prep: 'Bring your script.', notice: 'Use the stage entrance.' };
const content = { schedule: { rehearsals: [call] },
  scripts: { current: [
    { scene: '03', title: 'Chosen', approved: true, companyPublish: true, readUrl: 'scene-03.html' },
    { scene: '08', title: 'Still Yours', approved: false, companyPublish: false, readUrl: 'scene-08.html' },
    { scene: '09', title: 'Children', approved: true, companyPublish: true, readUrl: 'scene-09.html' }
  ] }, music: { current: [
    { title: 'Chosen', scenes: [3], approved: true, companyPublish: true, playUrl: 'assets/audio/chosen.mp3' },
    { title: 'Draft', scenes: [8], approved: false, companyPublish: false, playUrl: 'draft.mp3' }
  ] } };

test('exact calls accept canonical IDs, names, and explicit groups', () => {
  assert(personMatchesCall(person, call));
  assert(personMatchesCall(person, { ...call, calledPeopleIds: [], calledPeople: [{ displayName: 'Mary Andre' }] }));
  assert(personMatchesCall(person, { ...call, calledPeopleIds: [], calledGroups: [{ name: 'Full Company' }] }));
  assert(personMatchesCall(person, { ...call, calledPeopleIds: [], calledGroups: ['Principals/Featured'] }));
});

test('review calls and exact exclusions never fall back to names or broad role text', () => {
  assert.equal(personMatchesCall(person, { ...call, exactCallStatus: 'REVIEW', called: 'Mary André' }), false);
  assert.equal(personMatchesCall(person, { ...call, calledPeopleIds: [], called: 'Mary André', callGroups: ['Full Company'] }), false);
  assert.equal(personMatchesCall(person, { ...call, calledPeopleIds: ['P-mary-other'] }), false);
  assert.equal(personMatchesCall(person, { ...call, calledPeopleIds: [], calledGroups: [], calledPeople: ['Mary'] }), false);
});

test('legacy fallback remains limited to named people and safe groups', () => {
  assert(personMatchesCall(person, { called: 'Mary André is called' }));
  assert.equal(personMatchesCall(person, { callGroups: ['Principals/Featured'] }), false);
  assert(personMatchesCall({ ...person, groups: ['Dancers'] }, { callGroups: ['Dancers'] }));
});

test('remembered legacy IDs migrate and unknown people do not match', () => {
  const renamed = { ...person, legacyIds: ['old-mary'] };
  assert.equal(findPerson([renamed], 'P-old-mary'), renamed);
  assert.equal(findPerson([renamed], 'P-mary'), renamed);
  assert.equal(findPerson([renamed], 'retired-member'), null);
  assert.equal(findPerson([renamed], ''), null);
});

test('next call excludes ended, cancelled, invalid and no-rehearsal entries and sorts by start', () => {
  const later = { ...call, id: 'later', start: '2026-11-02T15:00:00Z', end: '2026-11-02T18:00:00Z' };
  const calls = [later, { ...call, status: 'CANCELLED' }, { ...call, title: 'NO REHEARSAL' },
    { ...call, end: '2026-10-29T18:00:00Z' }, { ...call, start: 'bad' }, call];
  assert.deepEqual(upcomingPublishedCalls(calls, now).map(item => item.id), ['next', 'later']);
});

test('an earlier unresolved call remains visible beside a later confirmed personal call', () => {
  const pending = { ...call, start: '2026-10-30T20:00:00Z', exactCallStatus: 'REVIEW' };
  const state = homeCallState(person, [pending, call], now);
  assert.equal(state.call, call);
  assert.equal(state.pending, true);
  assert.equal(homeCallState(person, [pending], now).call, null);
  assert.equal(homeCallState(null, [call], now).call, null);
});

test('personal report and end times never inherit the overall rehearsal window', () => {
  assert.deepEqual(personalCallSummary(person, call), { report: '11:00 AM', through: '1:00 PM' });
  assert.deepEqual(personalCallSummary(person, { ...call, personalCallTimes: {}, personalCallEndTimes: {} }), { report: '', through: '' });
});

test('show day distinguishes crew calls, company calls, and tentative show end', () => {
  const show = { ...call, showDay: { crewCall: '1:00 PM', companyCall: '3:00 PM', showtime: '6:00 PM', tentativeEnd: '8:00 PM' } };
  assert.equal(personalCallSummary(person, show).report, '3:00 PM');
  assert.equal(personalCallSummary({ ...person, groups: ['Crew/Tech'] }, show).report, '1:00 PM');
  assert.equal(personalCallSummary(person, show).through, '');
});

test('call material uses numbered call scenes intersected with assignments and approved publication', () => {
  assert.deepEqual(callScenes({ title: 'Scenes 3, 4, 5, 7 & 8 (Actors)' }), [3, 4, 5, 7, 8]);
  assert.deepEqual(callScenes({ title: 'Sequence Run 7–12' }), [7, 8, 9, 10, 11, 12]);
  assert.deepEqual(callScenes({ title: '10/31 Photoshoot 10–11 AM' }), []);
  const prep = preparationForCall(person, call, content);
  assert.deepEqual(prep.scenes, [3, 8]);
  assert.deepEqual(prep.scripts.map(item => item.title), ['Chosen']);
  assert.deepEqual(prep.music.map(item => item.title), ['Chosen']);
  assert.deepEqual(preparationForCall(person, { title: 'Scene 9' }, content).scenes, []);
  assert.equal(preparationForCall(person, { title: 'Company photos' }, content).callSpecific, false);
});

// Small DOM harness exercises selection, persistence, failure recovery and the
// rendered personal instructions without requiring a browser dependency in CI.
function harness({ saved = '', roster = [person], calls = [call], blocked = false, fail = false } = {}) {
  class Element {
    innerHTML = ''; textContent = ''; value = ''; hidden = false; disabled = true; href = 'company.html#my-role';
    handlers = {}; focused = false;
    addEventListener(name, handler) { this.handlers[name] = handler; }
    focus() { this.focused = true; }
    scrollIntoView() {}
    cloneNode() { return Object.assign(new Element(), { href: this.href, textContent: this.textContent }); }
    replaceWith(next) { elements['#homeCallButton'] = next; }
    fire(name) { return this.handlers[name]?.({ preventDefault() {} }); }
  }
  const elements = Object.fromEntries(['homePerson', 'my-next-call', 'homePreparation', 'homePersonHelp', 'homeCallButton', 'homeChangePerson'].map(id => ['#' + id, new Element()]));
  const values = new Map(saved ? [['chosen2026-person', saved]] : []);
  const root = { querySelector: id => elements[id], dispatchEvent() {} };
  const storage = { getItem: key => { if (blocked) throw Error('blocked'); return values.get(key); },
    setItem: (key, value) => { if (blocked) throw Error('blocked'); values.set(key, value); },
    removeItem: key => { if (blocked) throw Error('blocked'); values.delete(key); } };
  const options = { root, storage, clock: () => now,
    fetcher: async () => ({ ok: !fail, json: async () => ({ people: roster }) }) };
  return { elements, values, init: () => initHomeDashboard({ ...content, schedule: { rehearsals: calls } }, options) };
}

test('first visit starts unselected, choosing a person reveals times and approved materials', async () => {
  const h = harness(); await h.init();
  const select = h.elements['#homePerson'], panel = h.elements['#my-next-call'];
  assert.equal(select.disabled, false);
  assert.match(panel.innerHTML, /When are you needed/);
  select.value = 'mary'; select.fire('change');
  assert.equal(h.values.get('chosen2026-person'), 'mary');
  assert.match(panel.innerHTML, /11:00 AM/); assert.match(panel.innerHTML, /1:00 PM/);
  assert.match(panel.innerHTML, /Use the stage entrance/);
  assert.match(h.elements['#homePreparation'].innerHTML, /scene-03.html/);
  assert.doesNotMatch(h.elements['#homePreparation'].innerHTML, /draft.mp3|scene-09.html|scene-08.html/);
  h.elements['#homeCallButton'].fire('click'); assert(panel.focused);
});

test('changing family member replaces personal calls and clearing removes the remembered person', async () => {
  const other = { id: 'other', name: 'Other Child', scenes: [9], groups: ['Dancers'] };
  const h = harness({ saved: 'mary', roster: [person, other] }); await h.init();
  const select = h.elements['#homePerson']; select.value = 'other'; select.fire('change');
  assert.doesNotMatch(h.elements['#my-next-call'].innerHTML, /11:00 AM|Mary André/);
  assert.match(h.elements['#my-next-call'].innerHTML, /No upcoming confirmed call/);
  assert.doesNotMatch(h.elements['#homePreparation'].innerHTML, /scene-03.html/);
  h.elements['#homeChangePerson'].fire('click');
  assert.equal(h.values.has('chosen2026-person'), false);
  assert.equal(select.value, ''); assert(select.focused);
});

test('saved legacy selection is migrated; a stale selection is cleared', async () => {
  const legacy = harness({ saved: 'old-mary', roster: [{ ...person, legacyIds: ['old-mary'] }] });
  await legacy.init(); assert.equal(legacy.values.get('chosen2026-person'), 'mary');
  const stale = harness({ saved: 'former-member' }); await stale.init();
  assert.equal(stale.values.has('chosen2026-person'), false);
  assert.match(stale.elements['#my-next-call'].innerHTML, /When are you needed/);
});

test('missing personal times show a warning, not a fabricated report time', async () => {
  const h = harness({ saved: 'mary', calls: [{ ...call, personalCallTimes: {}, personalCallEndTimes: {} }] }); await h.init();
  assert.match(h.elements['#my-next-call'].innerHTML, /Overall rehearsal window/);
  assert.match(h.elements['#my-next-call'].innerHTML, /not published here/);
  assert.doesNotMatch(h.elements['#my-next-call'].innerHTML, /Your report time/);
});

test('blocked storage allows the current selection and explains its limits', async () => {
  const h = harness({ blocked: true }); await h.init();
  h.elements['#homePerson'].value = 'mary'; h.elements['#homePerson'].fire('change');
  assert.match(h.elements['#my-next-call'].innerHTML, /11:00 AM/);
  assert.match(h.elements['#homePersonHelp'].textContent, /could not remember/);
});

test('failed roster fetch leaves a working My Calls fallback', async () => {
  const h = harness({ fail: true }); await h.init();
  assert.equal(h.elements['#homePerson'].disabled, true);
  assert.equal(h.elements['#homeCallButton'].href, 'company.html#my-role');
  assert.match(h.elements['#my-next-call'].innerHTML, /could not be loaded/);
});

test('roster and call text are escaped before rendering', async () => {
  const h = harness({ saved: 'mary', roster: [{ ...person, name: '<img src=x onerror=alert(1)>' }],
    calls: [{ ...call, prep: '<script>alert(1)</script>' }] });
  await h.init();
  assert.doesNotMatch(h.elements['#my-next-call'].innerHTML, /<script>|<img /);
  assert.match(h.elements['#my-next-call'].innerHTML, /&lt;script&gt;/);
});

test('homepage has one primary call action and one Show Quest entry', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/id="homeCallButton"/g) || []).length, 1);
  assert.equal((html.match(/href="practice.html"/g) || []).length, 2); // Navigation plus the single practice card.
  assert(html.indexOf('id="homePreparation"') < html.indexOf('id="homeQuestTitle"'));
  assert.match(fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8'), /const personMatches = x => personMatchesCall\(person, x\)/);
});
