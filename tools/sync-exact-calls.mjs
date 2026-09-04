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

function normalizeStatus(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function isNoRehearsal(r) {
  const publicStatus = normalizeStatus(r.status);
  const title = normalizeStatus(r.title);

  return (
    publicStatus === 'NO REHEARSAL' ||
    title.includes('NO REHEARSAL')
  );
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

  for (const r of data.rehearsals) {
    /*
     * Administrative / NO REHEARSAL rows are allowed in the public
     * schedule but do not participate in personalized call matching.
     */
    if (isNoRehearsal(r)) {
      r.calledPeople = [];
      r.calledPeopleIds = [];
      r.calledGroups = [];
      r.exactCallStatus = 'HOLD';
      continue;
    }

    if (!r.eventKey) {
      throw new Error('Rehearsal missing eventKey.');
    }

    if (seen.has(r.eventKey)) {
      throw new Error(`Duplicate eventKey: ${r.eventKey}`);
    }

    seen.add(r.eventKey);

    const status = normalizeStatus(r.exactCallStatus);

    if (!['READY', 'REVIEW', 'HOLD'].includes(status)) {
      throw new Error(
        `Invalid exactCallStatus "${r.exactCallStatus}" for ${r.eventKey}`
      );
    }

    r.exactCallStatus = status;

    if (
      !Array.isArray(r.calledPeopleIds) ||
      !Array.isArray(r.calledGroups)
    ) {
      throw new Error(`Invalid call arrays for ${r.eventKey}`);
    }

    /*
     * Personalized targets are only allowed when the spreadsheet
     * explicitly marks the call data READY.
     */
    if (
      status !== 'READY' &&
      (r.calledPeopleIds.length > 0 || r.calledGroups.length > 0)
    ) {
      throw new Error(
        `Non-READY event ${r.eventKey} contains personalized call targets.`
      );
    }
  }

  return data;
}

let data;
let lastErr;

const attempts = [30000, 30000, 45000];

for (let i = 0; i < attempts.length; i++) {
  try {
    console.log(`Exact Calls sync attempt ${i + 1}/${attempts.length}...`);

    const fetched = await fetchWithTimeout(attempts[i]);
    data = validate(fetched);

    break;
  } catch (error) {
    lastErr = error;

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
      lastErr?.message || 'unknown error'
    }. Existing Hub rehearsal data was NOT changed.`
  );

  process.exit(1);
}

/*
 * Write only after the entire feed has passed validation.
 * This preserves the last known-good Hub data if anything fails.
 */
await fs.mkdir('data', { recursive: true });

const tempPath = 'data/rehearsals.json.tmp';
const finalPath = 'data/rehearsals.json';

await fs.writeFile(
  tempPath,
  JSON.stringify(data, null, 2) + '\n',
  'utf8'
);

await fs.rename(tempPath, finalPath);

const ready = data.rehearsals.filter(
  r => normalizeStatus(r.exactCallStatus) === 'READY'
).length;

const review = data.rehearsals.filter(
  r => normalizeStatus(r.exactCallStatus) === 'REVIEW'
).length;

const hold = data.rehearsals.filter(
  r => normalizeStatus(r.exactCallStatus) === 'HOLD'
).length;

const noRehearsal = data.rehearsals.filter(
  r => isNoRehearsal(r)
).length;

console.log(
  `Exact Calls sync OK: ${data.rehearsals.length} schedule entries; ` +
  `${ready} READY; ${review} REVIEW; ${hold} HOLD; ` +
  `${noRehearsal} NO REHEARSAL.`
);
