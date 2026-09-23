#!/usr/bin/env node
/**
 * Build the public cast roster consumed by company.html.
 *
 * data/company.json is the canonical, automation-synced company feed. The
 * browser-facing roster intentionally contains performers only; production
 * assignments remain available in data/company.json for Hub automation.
 *
 * Existing public profiles are preserved verbatim when their person remains a
 * performer. This keeps actor-facing role labels stable while still adding new
 * performers and removing people who have explicitly moved out of the cast.
 */
import fs from 'node:fs/promises';

const INPUT = 'data/company.json';
const REHEARSALS_INPUT = 'data/rehearsals.json';
const JSON_OUTPUT = 'company.json';

function normalizeId(value) {
  return String(value || '').trim().replace(/^P-/i, '');
}

function normalizeScenes(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
}

const source = JSON.parse(await fs.readFile(INPUT, 'utf8'));
if (!source || !Array.isArray(source.people)) {
  throw new Error(`${INPUT} must contain a people array.`);
}

const rehearsalsSource = JSON.parse(await fs.readFile(REHEARSALS_INPUT, 'utf8'));
const rehearsals = Array.isArray(rehearsalsSource)
  ? rehearsalsSource
  : Array.isArray(rehearsalsSource?.rehearsals)
    ? rehearsalsSource.rehearsals
    : [];

let existing = { schemaVersion: 1, source: 'CHOSEN 2026 Company Roster', people: [] };
try {
  existing = JSON.parse(await fs.readFile(JSON_OUTPUT, 'utf8'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
if (!Array.isArray(existing.people)) {
  throw new Error(`${JSON_OUTPUT} must contain a people array.`);
}

const normalizedName = value => String(value || '').trim().toLowerCase();
const sourceById = new Map(source.people.map(person => [normalizeId(person.id), person]));
const sourceByName = new Map(source.people.map(person => [normalizedName(person.name), person]));
const calledIds = new Set();
const calledNames = new Set();
for (const rehearsal of rehearsals) {
  for (const id of rehearsal.calledPeopleIds || []) calledIds.add(normalizeId(id));
  for (const person of rehearsal.calledPeople || []) {
    calledNames.add(normalizedName(person?.displayName || person?.name || person));
  }
}

const people = [];
const includedIds = new Set();

for (const current of existing.people) {
  const person = sourceById.get(normalizeId(current.id)) || sourceByName.get(normalizedName(current.name));

  // Preserve unmatched legacy profiles. Remove a profile only when the
  // canonical record explicitly says the person is no longer a performer.
  if (person && String(person.companyType || '').trim().toLowerCase() !== 'performer') continue;

  people.push(current);
  includedIds.add(normalizeId(current.id));
}

for (const person of source.people) {
  if (String(person.companyType || '').trim().toLowerCase() !== 'performer') continue;
  const id = normalizeId(person.id);
  if (includedIds.has(id) || people.some(current => normalizedName(current.name) === normalizedName(person.name))) continue;
  if (!calledIds.has(id) && !calledNames.has(normalizedName(person.name))) continue;

  people.push({
    id,
    name: String(person.name || '').trim(),
    roles: String(person.roles || person.primaryAssignment || '').trim(),
    scenes: normalizeScenes(person.scenes),
    understudy: person.understudy ? String(person.understudy).trim() : null,
    danceEnsemble: person.danceEnsemble === true,
    groups: Array.isArray(person.groups) ? person.groups.map(String).map(v => v.trim()).filter(Boolean) : [],
  });
}

people.sort((a, b) => a.name.localeCompare(b.name));

if (source.people.length && !people.length) {
  throw new Error('Refusing to publish an empty performer roster from non-empty company data.');
}

const ids = new Set();
for (const person of people) {
  if (!person.id || !person.name) throw new Error('Published performer is missing an id or name.');
  if (ids.has(person.id)) throw new Error(`Duplicate public performer id: ${person.id}`);
  ids.add(person.id);
}

const publicRoster = {
  schemaVersion: existing.schemaVersion || 1,
  source: existing.source || 'CHOSEN 2026 Company Roster',
  people,
};

await fs.writeFile(JSON_OUTPUT, `${JSON.stringify(publicRoster, null, 2)}\n`, 'utf8');

console.log(`Public company roster built: ${people.length} performers.`);
