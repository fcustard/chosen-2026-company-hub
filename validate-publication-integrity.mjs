#!/usr/bin/env node
/**
 * CHOSEN 2026 — Publication Integrity Validator V2
 *
 * Prevents published rehearsals from silently disappearing from
 * content.json because the legacy build contract lost publish=true.
 */

import fs from 'node:fs';

const read = p =>
  JSON.parse(
    fs.readFileSync(p, 'utf8')
  );

const rehearsals =
  read('data/rehearsals.json');

if (!Array.isArray(rehearsals)) {
  throw new Error(
    'data/rehearsals.json must be a rehearsal array.'
  );
}

const errors = [];
const seen = new Set();
let upcomingCount = 0;

const now = new Date();

function upper(v) {
  return String(v || '')
    .trim()
    .toUpperCase();
}

function isNoRehearsal(r) {
  return (
    upper(r.status) === 'NO REHEARSAL' ||
    upper(r.title).includes('NO REHEARSAL')
  );
}

for (const r of rehearsals) {
  const id =
    String(
      r.id ||
      r.eventKey ||
      ''
    ).trim();

  if (!id) {
    errors.push(
      'Rehearsal missing id/eventKey.'
    );

    continue;
  }

  if (seen.has(id)) {
    errors.push(
      `${id}: duplicate rehearsal id.`
    );

    continue;
  }

  seen.add(id);

  /*
   * CRITICAL BUILD CONTRACT
   *
   * tools/build.mjs selects:
   *   rehearsals.filter(r => r.publish)
   *
   * Therefore every record in this published-only rehearsal file
   * MUST carry publish=true.
   */
  if (r.publish !== true) {
    errors.push(
      `${id}: publish must equal true. ` +
      `Without it, build.mjs will silently omit this rehearsal.`
    );
  }

  if (
    !r.start ||
    !r.end ||
    !r.title
  ) {
    errors.push(
      `${id}: missing required field ` +
      `(start/end/title).`
    );

    continue;
  }

  if (isNoRehearsal(r)) {
    errors.push(
      `${id}: NO REHEARSAL/admin row leaked into ` +
      `data/rehearsals.json.`
    );
  }

  const start =
    new Date(r.start);

  const end =
    new Date(r.end);

  if (
    Number.isNaN(
      start.getTime()
    )
  ) {
    errors.push(
      `${id}: invalid start date "${r.start}".`
    );
  }

  if (
    Number.isNaN(
      end.getTime()
    )
  ) {
    errors.push(
      `${id}: invalid end date "${r.end}".`
    );
  }

  if (
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    end <= start
  ) {
    errors.push(
      `${id}: end must be after start.`
    );
  }

  const exactStatus =
    upper(r.exactCallStatus);

  if (
    ![
      'READY',
      'REVIEW',
      'HOLD'
    ].includes(exactStatus)
  ) {
    errors.push(
      `${id}: invalid exactCallStatus ` +
      `"${r.exactCallStatus}".`
    );
  }

  if (
    !Array.isArray(
      r.calledPeopleIds
    )
  ) {
    errors.push(
      `${id}: calledPeopleIds must be an array.`
    );
  }

  if (
    !Array.isArray(
      r.calledGroups
    )
  ) {
    errors.push(
      `${id}: calledGroups must be an array.`
    );
  }

  if (
    !Number.isNaN(
      end.getTime()
    ) &&
    end >= now
  ) {
    upcomingCount += 1;
  }
}

if (errors.length) {
  console.error(
    '\nPUBLICATION INTEGRITY VALIDATION FAILED\n'
  );

  errors.forEach(
    e =>
      console.error(
        '• ' + e
      )
  );

  process.exit(1);
}

console.log(
  `Publication integrity passed: ` +
  `${rehearsals.length} published rehearsal records; ` +
  `${upcomingCount} upcoming; all publish=true.`
);

if (
  rehearsals.length > 0 &&
  upcomingCount === 0
) {
  console.warn(
    'WARNING: Published rehearsals exist, but none are upcoming.'
  );
}
