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
    migrateProgress, migrateSharedProgress, getProgress };
`), scope);

const plain = value => JSON.parse(JSON.stringify(value));
const actorViewOverrides = JSON.parse(fs.readFileSync(
  path.join(root, 'data/actor-view-overrides.json'), 'utf8'
));
const base = [];
let expectedTotal = 0;
const eliStageLines = new Set([
  'Yes?', 'I have people everywhere.', 'I don’t even have floor left.', 'I’m sorry.',
]);
const directionCues = new Set([
  '06|JOSEPH|Rhythmically',
  '06|JOSEPH|Spoken/sung',
  '06|JOSEPH|Quietly',
]);
const reviewedStageCues = new Set();

for (let number = 1; number <= 12; number += 1) {
  const sceneNo = String(number).padStart(2, '0');
  const scene = JSON.parse(fs.readFileSync(
    path.join(root, `data/scenes/scene-${sceneNo}.json`), 'utf8'
  ));
  const actual = plain(scope.practice.extractLinesFromScene(scene, sceneNo, actorViewOverrides));
  let speaker = '';
  let priorText = '';
  const expected = [];

  for (let index = 0; index < scene.blocks.length; index += 1) {
    const block = scene.blocks[index];
    if (block.type === 'character') speaker = block.text.trim();
    if (block.type === 'character') {
      const next = scene.blocks.slice(index + 1).find(item => item.type !== 'spacer');
      if (next?.type === 'stage') {
        const key = `${sceneNo}|${speaker}|${next.text}`;
        assert.ok(directionCues.has(key) ||
          (sceneNo === '11' && speaker === 'INNKEEPER ELI' && eliStageLines.has(next.text)),
          `Review stage-styled text after a character cue: ${key}`);
        reviewedStageCues.add(key);
      }
    }
    const eliLine = sceneNo === '11' && speaker === 'INNKEEPER ELI' &&
      block.type === 'stage' && eliStageLines.has(block.text);
    if (actorViewOverrides.some(rule => rule.scene === sceneNo &&
      rule.type === block.type && rule.text === block.text)) continue;
    if (block.type !== 'dialogue' && !eliLine) continue;
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
  assert.deepEqual(plain(scope.practice.extractLinesFromScene(withStage, sceneNo, actorViewOverrides))
    .map(line => line.key), actual.map(line => line.key));

  base.push(...actual);
}

assert.equal(reviewedStageCues.size, directionCues.size + eliStageLines.size,
  'All reviewed stage-styled cues must still match the current script');
const eliLines = base.filter(line => line.sceneNumber === '11' && line.speaker === 'INNKEEPER ELI');
assert.deepEqual(eliLines.map(line => line.text), Array.from(eliStageLines),
  'Innkeeper Eli must see all four Scene 11 lines in script order');
for (const rule of actorViewOverrides) {
  assert.ok(!base.some(line => line.sceneNumber === rule.scene && line.text === rule.text),
    `Actor practice must omit stage movement or internal note: ${rule.text}`);
}

const all = plain(scope.practice.includeSharedLines(base));
const roles = plain(scope.practice.uniqueRoles(all));
const sourceRoles = new Set(base.map(line => line.speakerKey));
assert.equal(base.length, expectedTotal);
assert.equal(roles.length, sourceRoles.size - 3,
  'Shared speaker labels must not look like incomplete standalone roles');
for (const label of ['MARY & JOSEPH', 'NIA & SIMON', 'GOSSIPER 1 & 2']) {
  assert.ok(!roles.includes(label), `${label} must be practiced under each individual role`);
}
assert.deepEqual(new Set(all.map(line => line.speakerKey)), sourceRoles);

for (const line of base.filter(item => item.speaker.includes('&'))) {
  const parts = line.speaker.split(/\s*&\s*/);
  if (parts.length !== 2) continue;
  const second = /^\d+$/.test(parts[1])
    ? `${parts[0].replace(/\s+\d+$/, '')} ${parts[1]}` : parts[1];
  for (const member of [parts[0], second]) {
    const key = member.toUpperCase();
    if (sourceRoles.has(key)) {
      assert.ok(all.some(item => item.sharedSourceKey === line.key &&
        item.speakerKey === key && item.key !== line.key),
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

const sharedLine = base.find(line => line.speaker === 'MARY & JOSEPH');
const maryShared = all.find(line => line.sharedSourceKey === sharedLine.key && line.speakerKey === 'MARY');
const josephShared = all.find(line => line.sharedSourceKey === sharedLine.key && line.speakerKey === 'JOSEPH');
assert.ok(maryShared && josephShared);
assert.notEqual(maryShared.key, josephShared.key,
  'Each actor must track their shared dialogue independently');
storage.set('chosen2026-line-progress-v2', JSON.stringify({ [sharedLine.key]: 'work' }));
scope.practice.migrateSharedProgress(all);
assert.equal(scope.practice.getProgress()[maryShared.key], 'work');
assert.equal(scope.practice.getProgress()[josephShared.key], 'work');
storage.set('chosen2026-line-progress-v2', JSON.stringify({
  ...scope.practice.getProgress(), [maryShared.key]: 'known',
}));
scope.practice.migrateSharedProgress(all);
assert.equal(scope.practice.getProgress()[maryShared.key], 'known',
  'An actor’s new progress must not be overwritten by an old shared mark');
assert.equal(scope.practice.getProgress()[josephShared.key], 'work');

console.log(`Line practice verified: ${base.length} spoken lines across 12 scenes, ${roles.length} roles.`);
