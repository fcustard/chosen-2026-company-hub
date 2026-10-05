import assert from 'node:assert/strict';
import { buildSearchIndex, requestedDate, searchIndex } from '../search.js';

const entries = buildSearchIndex({
  content: {
    links: { absence: 'https://example.org/absence' },
    schedule: { rehearsals: [{
      eventKey: 'CHOSEN-20261008-REH', title: 'Scene 8 rehearsal',
      date: 'October 8, 2026', dateIso: '2026-10-08', time: '7:00 PM',
      end: '2099-10-09T00:00:00Z',
      called: 'Private cast roster', personalCallTimes: { person: '6:15 PM' }
    }, {
      eventKey: 'CHOSEN-20261015-REH', title: 'Scene 8 rehearsal',
      date: 'October 15, 2026', dateIso: '2026-10-15', time: '7:00 PM',
      end: '2099-10-16T00:00:00Z'
    }, {
      eventKey: 'CHOSEN-20261029-REH', title: 'Scenes 10–12 rehearsal',
      date: 'October 29, 2026', dateIso: '2026-10-29', time: '6:30 PM–8:30 PM',
      end: '2099-10-30T00:00:00Z'
    }] }
  },
  scripts: [
    { scene: '05', title: 'Brotherhood', approved: true, companyPublish: true, readUrl: 'scene-05.html' },
    { scene: '08', title: 'Journey', approved: true, companyPublish: true, readUrl: 'scene-08.html' },
    { scene: '06', title: 'Unpublished', approved: false, companyPublish: false, readUrl: 'scene-06.html' }
  ],
  music: [
    { title: 'Brotherhood', scenes: [5], approved: true, companyPublish: true, playUrl: 'assets/audio/brotherhood.mp3' },
    { title: 'Draft track', approved: false, companyPublish: false, playUrl: '#' }
  ],
  resources: [
    { title: 'Workbook', approved: true, companyPublish: true, fileUrl: 'resources/workbook.pdf' }
  ]
});

assert.equal(searchIndex(entries, 'scene 05')[0].url, 'scene-05.html');
assert.equal(searchIndex(entries, 'brotherhood').length, 2);
assert.equal(searchIndex(entries, 'October 8')[0].url, 'schedule.html#call-CHOSEN-20261008-REH');
assert.equal(searchIndex(entries, 'absence')[0].url, 'https://example.org/absence');
assert.equal(searchIndex(entries, 'wardrobe')[0].url, 'production.html#wardrobe');
assert.equal(searchIndex(entries, 'unpublished').length, 0);
assert.equal(searchIndex(entries, 'draft track').length, 0);
assert.equal(searchIndex(entries, 'Private cast roster').length, 0);
assert.equal(searchIndex(entries, '6:15').length, 0);
assert.equal(searchIndex(entries, '  ').length, 0);
const sundayNight = new Date('2026-10-05T03:06:00Z'); // October 4 in New York
assert.equal(requestedDate('today', sundayNight), '2026-10-04');
assert.equal(requestedDate('tomorrow', sundayNight), '2026-10-05');
assert.equal(requestedDate("Thursday's rehearsal", sundayNight), '2026-10-08');
assert.equal(requestedDate('Oct. 8', sundayNight), '2026-10-08');
assert.equal(requestedDate('10/8', sundayNight), '2026-10-08');
assert.equal(searchIndex(entries, 'Oct 8', { now: sundayNight })[0].url, 'schedule.html#call-CHOSEN-20261008-REH');
assert.deepEqual(searchIndex(entries, 'What time do I need to be there Thursday?', { now: sundayNight }).slice(0, 2).map(x => x.url),
  ['company.html#my-role', 'schedule.html#call-CHOSEN-20261008-REH']);
assert.equal(searchIndex(entries, 'when should I leave rehearsal?')[0].url, 'company.html#my-role');
assert.deepEqual(searchIndex(entries, 'where is rehearsal?').map(x => x.url), ['schedule.html']);
assert.equal(searchIndex(entries, 'scene eight')[0].url, 'scene-08.html');
assert.equal(searchIndex(entries, 'scene eight').some(x => x.url.includes('20261029')), false);
assert.equal(searchIndex(entries, 'song for scene five')[0].category, 'Music');
assert.equal(searchIndex(entries, 'where can I listen to Brotherhood?')[0].category, 'Music');
assert.equal(searchIndex(entries, 'which scene am I in?')[0].url, 'scripts.html');
assert.equal(searchIndex(entries, 'what should I wear to rehearsal?')[0].url, 'production.html#wardrobe');
assert.equal(searchIndex(entries, "I can't come to rehearsal")[0].url, 'https://example.org/absence');
assert.equal(searchIndex(entries, 'unknown gibberish').length, 0);
console.log('Search index checks passed.');
