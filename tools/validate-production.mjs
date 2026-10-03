import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parseCsv, dateIso, slotMinutes, validateFittings } from './wardrobe-feed.mjs';

assert.deepEqual(parseCsv('"Mary, Joseph","line 1\nline 2","a ""quote"""\r\nlast,end,ok'), [['Mary, Joseph','line 1\nline 2','a "quote"'],['last','end','ok']]);
assert.throws(() => parseCsv('"unfinished'), /Unclosed/);
assert.equal(dateIso('10/8/2026'), '2026-10-08');
assert.throws(() => dateIso('2/30/2026'), /Invalid/);
assert.deepEqual(slotMinutes('6:30–6:40 PM'), [1110,1120]);
const sample = { date: '2026-10-08', time: '6:30–6:40 PM', station: '1', performer: 'A', status: 'APPROVED — staffing pending' };
const roster = { people: [{ id: 'P-a', name: 'A' }, { id: 'P-b', name: 'B' }] };
const calls = [{ eventKey: 'CHOSEN-20261008-REH', personalCallTimes: { 'P-a': '6:30 PM', 'P-b': '6:30 PM' }, personalCallEndTimes: { 'P-a': '8:30 PM', 'P-b': '8:30 PM' } }];
assert.throws(() => validateFittings({ fittings: [sample, { ...sample, performer: 'B' }] }, roster, calls), /double-booked/);
assert.throws(() => validateFittings({ fittings: [{ ...sample, time: '6:20–6:30 PM' }] }, roster, calls), /outside/);
const plan = JSON.parse(await fs.readFile('data/wardrobe.json', 'utf8'));
const company = JSON.parse(await fs.readFile('data/company.json', 'utf8'));
const rehearsals = JSON.parse(await fs.readFile('data/rehearsals.json', 'utf8'));
validateFittings(plan, company, rehearsals);
for (const row of plan.schedule) {
  assert(row.date && row.time && row.phase && row.group && row.task && row.alignment && row.goal, 'Incomplete wardrobe planning row');
}
console.log(`Production validation passed: ${plan.fittings.filter(f => !f.buffer).length} fitting slots agree with published personal calls; CSV quoting and overlap guards passed.`);
