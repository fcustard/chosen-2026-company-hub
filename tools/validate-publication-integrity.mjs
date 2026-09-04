#!/usr/bin/env node
/**
 * CHOSEN 2026 — Publication Integrity Validator V1
 *
 * Purpose:
 * Prevent a published rehearsal from silently disappearing from:
 * - All Calls
 * - Home "Next Rehearsal"
 *
 * Exact-call status controls personalization ONLY.
 * Publication status controls whether the rehearsal exists on the Hub.
 *
 * Reads:
 *   data/rehearsals.json
 *
 * Required Hub rehearsal fields:
 *   id
 *   start
 *   end
 *   title
 *
 * Exact Calls V1.1 fields:
 *   exactCallStatus = READY | REVIEW | HOLD
 *   calledPeopleIds[]
 *   calledGroups[]
 *
 * Rules:
 * 1. Every rehearsal in data/rehearsals.json is considered published Hub data.
 * 2. REVIEW/HOLD may NEVER remove a rehearsal from All Calls.
 * 3. READY/REVIEW/HOLD only affect My Calls eligibility.
 * 4. start/end must be parseable and end > start.
 * 5. no duplicate rehearsal ids.
 * 6. no NO REHEARSAL admin rows may leak into data/rehearsals.json.
 * 7. upcoming schedule must be derivable from published rehearsal data.
 */

import fs from 'node:fs';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const rehearsals = read('data/rehearsals.json');

if (!Array.isArray(rehearsals)) {
  throw new Error('data/rehearsals.json must be a rehearsal array.');
}

const errors = [];
const seen = new Set();
let upcomingCount = 0;

const now = new Date();

function upper(v) {
  return String(v || '').trim().toUpperCase();
}

function isNoRehearsal(r) {
  return (
    upper(r.status) === 'NO REHEARSAL' ||
    upper(r.title).includes('NO REHEARSAL')
  );
}

for (const r of rehearsals) {
  const id = String(r.id || r.eventKey || '').trim();

  if (!id) {
    errors.push('Rehearsal missing id/eventKey.');
    continue;
  }

  if (seen.has(id)) {
    errors.push(`${id}: duplicate rehearsal id.`);
    continue;
  }
  seen.add(id);

  if (!r.start || !r.end || !r.title) {
    errors.push(`${id}: missing required field (start/end/title).`);
    continue;
  }

  if (isNoRehearsal(r)) {
    errors.push(
      `${id}: NO REHEARSAL/admin row leaked into data/rehearsals.json.`
    );
  }

  const start = new Date(r.start);
  const end = new Date(r.end);

  if (Number.isNaN(start.getTime())) {
    errors.push(`${id}: invalid start date "${r.start}".`);
  }

  if (Number.isNaN(end.getTime())) {
    errors.push(`${id}: invalid end date "${r.end}".`);
  }

  if (
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    end <= start
  ) {
    errors.push(`${id}: end must be after start.`);
  }

  const exactStatus = upper(r.exactCallStatus);

  if (!['READY', 'REVIEW', 'HOLD'].includes(exactStatus)) {
    errors.push(
      `${id}: invalid exactCallStatus "${r.exactCallStatus}".`
    );
  }

  if (Array.isArray(r.calledPeopleIds) === false) {
    errors.push(`${id}: calledPeopleIds must be an array.`);
  }

  if (Array.isArray(r.calledGroups) === false) {
    errors.push(`${id}: calledGroups must be an array.`);
  }

  // Exact Call status must NEVER suppress publication.
  if (
    ['REVIEW', 'HOLD'].includes(exactStatus) &&
    r.publishForAllCalls === false
  ) {
    errors.push(
      `${id}: ${exactStatus} rehearsal is incorrectly suppressed from All Calls.`
    );
  }

  if (
    !Number.isNaN(end.getTime()) &&
    end >= now
  ) {
    upcomingCount += 1;
  }
}

if (errors.length) {
  console.error('\nPUBLICATION INTEGRITY VALIDATION FAILED\n');
  errors.forEach(e => console.error('• ' + e));
  process.exit(1);
}

console.log(
  `Publication integrity passed: ${rehearsals.length} published rehearsal records; ` +
  `${upcomingCount} upcoming.`
);

if (upcomingCount === 0) {
  console.warn(
    'WARNING: No upcoming rehearsals are currently present in data/rehearsals.json.'
  );
}
