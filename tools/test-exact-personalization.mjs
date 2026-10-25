import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('a withdrawn member is valid only in explicitly preserved historical calls', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'chosen-former-member-'));
  const validator = fileURLToPath(new URL('./validate-exact-personalization.mjs', import.meta.url));
  try {
    mkdirSync(path.join(root, 'data'));
    const write = (file, data) => writeFileSync(path.join(root, 'data', file), JSON.stringify(data));
    write('company.json', { people: [{ id: 'P-active', groups: ['Dancers'] }] });
    write('former-company-members.json', { members: [{ id: 'P-former', historicalThroughDate: '2026-10-24' }] });
    const run = (id, personId) => {
      write('rehearsals.json', [{ id, exactCallStatus: 'READY', calledPeopleIds: [personId], calledGroups: [] }]);
      return spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
    };
    assert.equal(run('CHOSEN-20261024-REH', 'P-former').status, 0);
    assert.notEqual(run('CHOSEN-20261028-REH', 'P-former').status, 0);
    assert.notEqual(run('CHOSEN-20261024-REH', 'P-mistyped').status, 0);
    assert.equal(run('CHOSEN-20261028-REH', 'P-active').status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
