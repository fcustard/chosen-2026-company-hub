import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'line-practice.js'), 'utf8');
const entry = '  init();';
assert.equal(source.split(entry).length, 2, 'Line practice entry point changed');

const scope = {
  document: { body: { dataset: { page: 'lines' } }, getElementById: () => null },
  URLSearchParams,
};
const storage = new Map();
scope.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
vm.runInNewContext(source.replace(entry, `
  globalThis.practice = { extractLinesFromScene, includeSharedLines, uniqueRoles,
    migrateProgress, getProgress };
`), scope);

const plain = value => JSON.parse(JSON.stringify(value));
const base = [];
let expectedTotal = 0;

for (let number = 1; number <= 12; number += 1) {
  const sceneNo = String(number).padStart(2, '0');
  const scene = JSON.parse(fs.readFileSync(
    path.join(root, `data/scenes/scene-${sceneNo}.json`), 'utf8'
  ));
  const actual = plain(scope.practice.extractLinesFromScene(scene, sceneNo));
  let speaker = '';
  let priorText = '';
  const expected = [];

  for (const block of scene.blocks) {
    if (block.type === 'character') speaker = block.text.trim();
    if (block.type !== 'dialogue') continue;
    assert.ok(speaker, `Scene ${sceneNo} has dialogue without a speaker`);
    expected.push({ speaker, text: block.text.replace(/\s+/g, ' ').trim(), cue: priorText });
    priorText = block.text.replace(/\s+/g, ' ').trim();
  }

  assert.deepEqual(actual.map(line => ({
    speaker: line.speaker,
    text: line.text,
    cue: line.cue === 'Opening line / no cue before this line.' ? '' : line.cue,
  })), expected, `Scene ${sceneNo}: spoken lines must match the approved script`);
  expectedTotal += expected.length;
  assert.equal(new Set(actual.map(line => line.key)).size, actual.length,
    `Scene ${sceneNo}: progress keys must be unique`);

  // Reordering a non-dialogue cue must not reset an actor's saved progress.
  const withStage = { ...scene, blocks: [scene.blocks[0],
    { type: 'stage', text: 'A lighting cue.' }, ...scene.blocks.slice(1)] };
  assert.deepEqual(plain(scope.practice.extractLinesFromScene(withStage, sceneNo))
    .map(line => line.key), actual.map(line => line.key));

  base.push(...actual);
}

const all = plain(scope.practice.includeSharedLines(base));
const roles = plain(scope.practice.uniqueRoles(all));
const sourceRoles = new Set(base.map(line => line.speakerKey));
assert.equal(base.length, expectedTotal);
assert.equal(roles.length, sourceRoles.size, 'Every role must come from a typed character cue');
assert.deepEqual(new Set(all.map(line => line.speakerKey)), sourceRoles);

for (const line of base.filter(item => item.speaker.includes('&'))) {
  const parts = line.speaker.split(/\s*&\s*/);
  if (parts.length !== 2) continue;
  const second = /^\d+$/.test(parts[1])
    ? `${parts[0].replace(/\s+\d+$/, '')} ${parts[1]}` : parts[1];
  for (const member of [parts[0], second]) {
    const key = member.toUpperCase();
    if (sourceRoles.has(key)) {
      assert.ok(all.some(item => item.key === line.key && item.speakerKey === key),
        `${member} must see the shared line in their practice set`);
    }
  }
}

const remembered = base.find(line => base.filter(other =>
  other.sceneNumber === line.sceneNumber &&
  other.sourceSpeakerKey === line.sourceSpeakerKey &&
  other.text === line.text
).length === 1);
assert.ok(remembered, 'Expected at least one unique line for progress migration');
const [sceneNo, role, hash] = remembered.key.split('|');
storage.set('chosen2026-line-progress-v1', JSON.stringify({
  [`${sceneNo}|${role}|999|${hash}`]: 'known',
}));
scope.practice.migrateProgress(base);
assert.equal(scope.practice.getProgress()[remembered.key], 'known',
  'Existing actor progress must migrate when old card positions change');

console.log(`Line practice verified: ${base.length} spoken lines across 12 scenes, ${roles.length} roles.`);
