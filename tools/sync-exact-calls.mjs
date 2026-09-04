#!/usr/bin/env node

import fs from 'node:fs/promises';

const configured = process.env.CALENDAR_FEED_URL;

if (!configured) {
  throw new Error('CALENDAR_FEED_URL is not configured.');
}

/*
 * Keep the existing repository variable.
 * This script changes the requested feed to hub-v2 automatically.
 */
const url = new URL(configured);
url.searchParams.set('feed', 'hub-v2');

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

function normalizeStatus(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function isNoRehearsal(rehearsal) {
  const publicStatus = normalizeStatus(rehearsal.status);
  const title = normalizeStatus(rehearsal.title);

  return (
    publicStatus === 'NO REHEARSAL' ||
    title.includes('NO REHEARSAL')
  );
}

async function fetchWithTimeout(ms) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    ms
  );

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(
        `Calendar feed returned HTTP ${response.status}`
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function validateFeedEnvelope(data) {
  if (!data) {
    throw new Error(
      'Exact Calls feed returned no data.'
    );
  }

  if (data.ok !== true) {
    throw new Error(
      'Exact Calls feed did not return ok=true.'
    );
  }

  if (data.schemaVersion !== 3) {
    throw new Error(
      `Unsupported Exact Calls schemaVersion: ${data.schemaVersion}`
    );
  }

  if (!Array.isArray(data.rehearsals)) {
    throw new Error(
      'Exact Calls feed rehearsals property is not an array.'
    );
  }

  return data.rehearsals;
}

function validateAndNormalizeRehearsals(rehearsals) {
  const seen = new Set();

  const normalized = [];

  for (const rehearsal of rehearsals) {
    /*
     * Preserve NO REHEARSAL entries in the public schedule,
     * but ensure they can never become personalized calls.
     */
    if (isNoRehearsal(rehearsal)) {
      rehearsal.calledPeople = [];
      rehearsal.calledPeopleIds = [];
      rehearsal.calledGroups = [];
      rehearsal.exactCallStatus = 'HOLD';

      normalized.push(rehearsal);
      continue;
    }

    if (!rehearsal.eventKey) {
      throw new Error(
        'Published rehearsal is missing eventKey.'
      );
    }

    if (seen.has(rehearsal.eventKey)) {
      throw new Error(
        `Duplicate eventKey: ${rehearsal.eventKey}`
      );
    }

    seen.add(rehearsal.eventKey);

    const exactCallStatus =
      normalizeStatus(rehearsal.exactCallStatus);

    if (
      !['READY', 'REVIEW', 'HOLD']
        .includes(exactCallStatus)
    ) {
      throw new Error(
        `Invalid exactCallStatus ` +
        `"${rehearsal.exactCallStatus}" ` +
        `for ${rehearsal.eventKey}`
      );
    }

    /*
     * Normalize the status before it reaches the Hub.
     */
    rehearsal.exactCallStatus =
      exactCallStatus;

    if (
      !Array.isArray(rehearsal.calledPeopleIds) ||
      !Array.isArray(rehearsal.calledGroups)
    ) {
      throw new Error(
        `Invalid Exact Calls arrays for ` +
        `${rehearsal.eventKey}`
      );
    }

    /*
     * Only READY events may contain authoritative
     * personalized call targets.
     */
    if (
      exactCallStatus !== 'READY' &&
      (
        rehearsal.calledPeopleIds.length > 0 ||
        rehearsal.calledGroups.length > 0
      )
    ) {
      throw new Error(
        `Non-READY event ${rehearsal.eventKey} ` +
        `contains personalized call targets.`
      );
    }

    normalized.push(rehearsal);
  }

  return normalized;
}

/*
 * Retry strategy protects against temporary
 * Google Apps Script/network delays.
 */
const attempts = [
  30000,
  30000,
  45000
];

let rehearsals = null;
let lastError = null;

for (
  let i = 0;
  i < attempts.length;
  i++
) {
  try {
    console.log(
      `Exact Calls sync attempt ` +
      `${i + 1}/${attempts.length}...`
    );

    const feed =
      await fetchWithTimeout(
        attempts[i]
      );

    const feedRehearsals =
      validateFeedEnvelope(feed);

    rehearsals =
      validateAndNormalizeRehearsals(
        feedRehearsals
      );

    break;
  } catch (error) {
    lastError = error;

    console.warn(
      `Attempt ${i + 1} failed: ` +
      `${error.message}`
    );

    if (i < attempts.length - 1) {
      await sleep(
        (i + 1) * 3000
      );
    }
  }
}

if (!rehearsals) {
  console.error(
    `EXACT CALLS SYNC ERROR: ` +
    `${lastError?.message || 'unknown error'}. ` +
    `Existing Hub rehearsal data was NOT changed.`
  );

  process.exit(1);
}

/*
 * IMPORTANT ARCHITECTURE RULE
 *
 * The Apps Script feed uses an envelope:
 *
 * {
 *   ok: true,
 *   schemaVersion: 3,
 *   rehearsals: [...]
 * }
 *
 * But the existing CHOSEN Hub expects:
 *
 * data/rehearsals.json
 *
 * to contain the rehearsal ARRAY itself.
 *
 * Therefore we deliberately write ONLY
 * the normalized rehearsals array below.
 *
 * This preserves compatibility with:
 * - tools/validate.mjs
 * - tools/build.mjs
 * - content generation
 * - existing Hub schedule rendering
 */

await fs.mkdir(
  'data',
  {
    recursive: true
  }
);

const tempPath =
  'data/rehearsals.json.tmp';

const finalPath =
  'data/rehearsals.json';

await fs.writeFile(
  tempPath,
  JSON.stringify(
    rehearsals,
    null,
    2
  ) + '\n',
  'utf8'
);

/*
 * Atomic replacement:
 * the old good file remains untouched
 * unless the new feed fully validates.
 */
await fs.rename(
  tempPath,
  finalPath
);

const ready =
  rehearsals.filter(
    rehearsal =>
      rehearsal.exactCallStatus ===
      'READY'
  ).length;

const review =
  rehearsals.filter(
    rehearsal =>
      rehearsal.exactCallStatus ===
      'REVIEW'
  ).length;

const hold =
  rehearsals.filter(
    rehearsal =>
      rehearsal.exactCallStatus ===
      'HOLD'
  ).length;

const noRehearsal =
  rehearsals.filter(
    rehearsal =>
      isNoRehearsal(rehearsal)
  ).length;

console.log(
  `Exact Calls sync OK: ` +
  `${rehearsals.length} schedule entries; ` +
  `${ready} READY; ` +
  `${review} REVIEW; ` +
  `${hold} HOLD; ` +
  `${noRehearsal} NO REHEARSAL.`
);

console.log(
  'data/rehearsals.json written as a rehearsal array ' +
  'for compatibility with the existing Hub build pipeline.'
);
