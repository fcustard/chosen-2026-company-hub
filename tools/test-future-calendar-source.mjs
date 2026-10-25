import test from 'node:test';
import assert from 'node:assert/strict';
import { createCalendarBaseline } from './calendar-merge.mjs';
import { mergeFutureCalendarRows } from './future-calendar-source.mjs';

const header = Array(27).fill('');
Object.assign(header, { 0:'Date', 4:'Rehearsal Plan', 5:'Who Is Called', 9:'Event Key',
  10:'Start Date/Time', 11:'End Date/Time', 12:'Location', 13:'Public Status', 15:'Public Title',
  16:'Public Notes', 18:'Approval Status', 19:'Publish?', 23:'Called People (Exact)',
  24:'Called Groups (Exact)', 25:'Exact Call Status' });
const personalHeader = ['Event Key','Date','Person ID','Person','Report Time','Release Time','Status'];
const event = { id:'CHOSEN-20261028-REH', eventKey:'CHOSEN-20261028-REH',
  start:'Oct 28, 2026 6:30 PM', end:'Oct 28, 2026 9:30 PM', title:'Rehearsal',
  location:'Faith Center', status:'CONFIRMED', called:'6:30–9:30 PM — A', work:'', prep:'',
  calledPeople:['A'], calledPeopleIds:['P-a'], calledGroups:[], exactCallStatus:'READY', callDataVersion:3 };
const past = { ...event, id:'CHOSEN-20261001-REH', eventKey:'CHOSEN-20261001-REH',
  start:'Oct 1, 2026 6:30 PM', end:'Oct 1, 2026 9:30 PM', calledPeople:['Former'], calledPeopleIds:['P-former'] };
function fixture() {
  const row = Array(27).fill('');
  Object.assign(row, { 0:'Oct 28, 2026', 5:event.called, 9:event.id, 10:event.start, 11:event.end,
    12:event.location, 13:event.status, 15:event.title, 18:'APPROVED', 19:'YES', 23:'A', 25:'READY' });
  return { rows:[header,row], personal:[personalHeader,[event.id,'Oct 28, 2026','P-a','A','6:30 PM','9:30 PM','READY'],
    [past.id,'Oct 1, 2026','P-former','Former','6:30 PM','9:30 PM','READY']],
    company:{people:[{id:'P-a',name:'A',groups:['Dancers']},{id:'P-b',name:'B',groups:['Dancers']}]},
    published:[structuredClone(past),structuredClone(event)], baseline:createCalendarBaseline([past,event]) };
}
const merge = f => mergeFutureCalendarRows(f.rows,f.personal,f.company,f.published,f.baseline,new Date('2026-10-25T01:00:00Z'));

test('future Sheet calls sync without changing historical withdrawn-person records', () => {
  const f = fixture(), result = merge(f);
  assert.deepEqual(result.rehearsals[0], past);
  assert.equal(result.rehearsals[1].personalCallTimes['P-a'],'6:30 PM');
  assert.equal(result.rehearsals[1].personalCallEndTimes['P-a'],'9:30 PM');
  assert.deepEqual(result.baseline.events[past.id], f.baseline.events[past.id]);
  assert.ok(!JSON.stringify(result.rehearsals).includes('Internal Notes'));
});

test('invalid, incomplete, duplicate, or unconfirmed future calls stop publication', () => {
  let f = fixture(); f.rows[1][23]='Former'; assert.throws(()=>merge(f),/unknown active/);
  f=fixture(); f.rows[1][23]='A, B'; assert.throws(()=>merge(f),/Incomplete personal/);
  f=fixture(); f.personal.push(f.personal[1]); assert.throws(()=>merge(f),/Duplicate personal/);
  f=fixture(); f.personal[1][4]='6:00 PM'; assert.throws(()=>merge(f),/outside event/);
  f=fixture(); f.rows[1][25]='REVIEW'; assert.throws(()=>merge(f),/Unconfirmed/);
  f=fixture(); f.rows[1][19]='NO'; assert.throws(()=>merge(f),/No future approved/);
  f=fixture(); f.rows.push(f.rows[1]); assert.throws(()=>merge(f),/Duplicate future/);
  f=fixture(); f.rows[1][24]='Unknown group'; assert.throws(()=>merge(f),/Unknown called group/);
});

test('future source edits retain the existing conflict protection for reviewed overrides', () => {
  const f=fixture(); f.published[1].work='Reviewed override'; f.rows[1][4]='New source edit';
  assert.throws(()=>merge(f),/reviewed Hub override/);
});
