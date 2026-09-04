#!/usr/bin/env node

import fs from 'node:fs/promises';

const configured = process.env.CALENDAR_FEED_URL;

if (!configured) {
  throw new Error('CALENDAR_FEED_URL is not configured.');
}

const url = new URL(configured);
url.searchParams.set('feed', 'hub-v2');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function validate(data) {
  if (
    !data ||
    data.ok !== true ||
    data.schemaVersion !== 3 ||
    !Array.isArray(data.rehearsals)
  ) {
    throw new Error('Invalid Exact Calls feed envelope.');
  }

  const seen = new Set();

  for (const rehearsal of data.rehearsals) {
    if (!rehearsal.eventKey) {
      throw new Error('Rehearsal missing eventKey.');
    }

    if (seen.has(rehearsal.eventKey)) {
      throw new Error(`Duplicate eventKey: ${rehearsal.eventKey}`);
    }

    seen.add(rehearsal.eventKey);

    const exactCallStatus = String(
      rehearsal.exactCallStatus || ''
    )
      .trim()
      .toUpperCase();

    if (!['READY', 'REVIEW', 'HOLD'].includes(exactCallStatus)) {
      throw new Error(
        `Invalid exactCallStatus "${rehearsal.exactCallStatus}" for ${rehearsal.eventKey}`
      );
    }

    if (
      !Array.isArray(rehearsal.calledPeopleIds) ||
      !Array.isArray(rehearsal.calledGroups)
    ) {
      throw new Error(
        `Invalid call arrays for ${rehearsal.eventKey}`
      );
    }

    if (
      exactCallStatus !== 'READY' &&
      (
        rehearsal.calledPeopleIds.length > 0 ||
        rehearsal.calledGroups.length > 0
      )
    ) {
      throw new Error(
        `Non-READY event ${rehearsal.eventKey} contains personalized call targets.`
      );
    }

    // Normalize before saving to data/rehearsals.json.
    rehearsal.exactCallStatus = exactCallStatus;
  }

  return data;
}

let data = null;
let lastError = null;

const attempts = [30000, 30000, 45000];

for (let i = 0; i < attempts.length; i++) {
  try {
    console.log(
      `Exact Calls sync attempt ${i + 1}/${attempts.length}...`
    );

    const fetched = await fetchWithTimeout(attempts[i]);
    data = validate(fetched);

    break;
  } catch (error) {
    lastError = error;

    console.warn(
      `Attempt ${i + 1} failed: ${error.message}`
    );

    if (i < attempts.length - 1) {
      await sleep((i + 1) * 3000);
    }
  }
}

if (!data) {
  console.error(
    `EXACT CALLS SYNC ERROR: ${
      lastError?.message || 'unknown error'
    }. Existing Hub rehearsal data was NOT changed.`
  );

  process.exit(1);
}

await fs.mkdir('data', {
  recursive: true
});

const tempPath = 'data/rehearsals.json.tmp';
const finalPath = 'data/rehearsals.json';

await fs.writeFile(
  tempPath,
  JSON.stringify(data, null, 2) + '\n',
  'utf8'
);

await fs.rename(
  tempPath,
  finalPath
);

const ready = data.rehearsals.filter(
  rehearsal => rehearsal.exactCallStatus === 'READY'
).length;

const review = data.rehearsals.filter(
  rehearsal => rehearsal.exactCallStatus === 'REVIEW'
).length;

const hold = data.rehearsals.filter(
  rehearsal => rehearsal.exactCallStatus === 'HOLD'
).length;

console.log(
  `Exact Calls sync OK: ${data.rehearsals.length} rehearsals; ` +
  `${ready} READY; ${review} REVIEW; ${hold} HOLD.`
);
