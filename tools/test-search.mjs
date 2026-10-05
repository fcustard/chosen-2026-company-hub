import assert from 'node:assert/strict';
import { buildSearchIndex, searchIndex } from '../search.js';

const entries = buildSearchIndex({
  content: {
    links: { absence: 'https://example.org/absence' },
    schedule: { rehearsals: [{
      eventKey: 'CHOSEN-20261008-REH', title: 'Scene 8 rehearsal',
      date: 'October 8, 2026', dateIso: '2026-10-08', time: '7:00 PM',
      end: '2099-10-09T00:00:00Z',
      called: 'Private cast roster', personalCallTimes: { person: '6:15 PM' }
    }] }
  },
  scripts: [
    { scene: '05', title: 'Brotherhood', approved: true, companyPublish: true, readUrl: 'scene-05.html' },
    { scene: '06', title: 'Unpublished', approved: false, companyPublish: false, readUrl: 'scene-06.html' }
  ],
  music: [
    { title: 'Brotherhood', approved: true, companyPublish: true, playUrl: 'assets/audio/brotherhood.mp3' },
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
console.log('Search index checks passed.');
