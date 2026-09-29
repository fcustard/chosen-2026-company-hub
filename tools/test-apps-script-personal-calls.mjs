import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync('tools/apps-script-personal-calls.gs', 'utf8');
const context = vm.createContext({});
vm.runInContext(code, context);
const attach = context.attachPersonalCallsToHubFeed_;
const header = ['Event Key', 'Date', 'Person ID', 'Person',
  'Report Time', 'Release Time', 'Status'];
const row = [
  'CHOSEN-20261008-REH', 'Oct 8, 2026', 'P-dancer', 'Dancer',
  '6:30 PM', '8:30 PM', 'READY'
];
const sheet = rows => ({
  getSheetByName: () => ({ getDataRange: () => ({ getDisplayValues: () => rows }) })
});
const event = () => [{
  id: 'CHOSEN-20261008-REH', exactCallStatus: 'READY',
  calledPeopleIds: [], calledGroups: ['Dancers']
}];

const result = attach(event(), sheet([header, row]))[0];
assert.deepEqual(Array.from(result.calledPeopleIds), ['P-dancer']);
assert.deepEqual(Array.from(result.calledGroups), []);
assert.equal(result.personalCallTimes['P-dancer'], '6:30 PM');
assert.equal(result.personalCallEndTimes['P-dancer'], '8:30 PM');
assert.throws(() => attach(event(), sheet([header, row, row])), /Duplicate/);
assert.throws(() => attach(event(), sheet([header, [...row.slice(0, 5), '6:00 PM', 'READY']])), /Invalid/);
console.log('Apps Script personal call feed helper verified.');
