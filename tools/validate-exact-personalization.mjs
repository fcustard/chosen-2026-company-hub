#!/usr/bin/env node
/**
 * CHOSEN 2026 — Exact Personalization Contract Validator
 *
 * Cross-checks:
 * - data/rehearsals.json
 * - data/company.json
 *
 * Guarantees before the Hub build:
 * - every READY calledPeopleId exists in the published company feed
 * - every exact called group is represented by at least one published person
 *   (except reserved Full Company)
 * - REVIEW/HOLD events contain no personalized targets
 * - no duplicate calledPeopleIds
 */
import fs from 'node:fs';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const rehearsals = read('data/rehearsals.json');
const companyEnvelope = read('data/company.json');

if (!Array.isArray(rehearsals)) {
  throw new Error('data/rehearsals.json must be a rehearsal array.');
}

if (
  !companyEnvelope ||
  !Array.isArray(companyEnvelope.people)
) {
  throw new Error('data/company.json must contain a people array.');
}

const people = companyEnvelope.people;
const peopleById = new Map();
const knownGroups = new Set();

for (const person of people) {
  if (!person.id) {
    throw new Error('Published company person missing id.');
  }

  if (peopleById.has(person.id)) {
    throw new Error(`Duplicate company person id: ${person.id}`);
  }

  peopleById.set(person.id, person);

  for (const group of Array.isArray(person.groups) ? person.groups : []) {
    if (group) knownGroups.add(String(group).trim());
  }
}

const errors = [];
let ready = 0;
let review = 0;
let hold = 0;

for (const rehearsal of rehearsals) {
  const id = rehearsal.id || rehearsal.eventKey || 'unknown rehearsal';
  const status = String(rehearsal.exactCallStatus || '').trim().toUpperCase();

  if (!['READY', 'REVIEW', 'HOLD'].includes(status)) {
    errors.push(`${id}: invalid exactCallStatus "${rehearsal.exactCallStatus}"`);
    continue;
  }

  if (status === 'READY') ready++;
  if (status === 'REVIEW') review++;
  if (status === 'HOLD') hold++;

  const ids = Array.isArray(rehearsal.calledPeopleIds)
    ? rehearsal.calledPeopleIds.map(String)
    : [];

  const groups = Array.isArray(rehearsal.calledGroups)
    ? rehearsal.calledGroups.map(String)
    : [];

  if (status !== 'READY' && (ids.length || groups.length)) {
    errors.push(`${id}: ${status} event contains personalized call targets`);
    continue;
  }

  if (status !== 'READY') continue;

  if (new Set(ids).size !== ids.length) {
    errors.push(`${id}: duplicate calledPeopleIds`);
  }

  for (const personId of ids) {
    if (!peopleById.has(personId)) {
      errors.push(`${id}: calledPeopleId "${personId}" is not in data/company.json`);
    }
  }

  for (const group of groups) {
    if (group === 'Full Company') continue;

    if (!knownGroups.has(group)) {
      errors.push(
        `${id}: called group "${group}" is not assigned to any published company person`
      );
    }
  }
}

if (errors.length) {
  console.error('\nEXACT PERSONALIZATION VALIDATION FAILED\n');
  errors.forEach(error => console.error('• ' + error));
  process.exit(1);
}

console.log(
  `Exact personalization validation passed: ` +
  `${people.length} people; ${rehearsals.length} rehearsals; ` +
  `${ready} READY; ${review} REVIEW; ${hold} HOLD.`
);
