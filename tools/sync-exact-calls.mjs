#!/usr/bin/env node

import fs from 'node:fs/promises';

const configured = process.env.CALENDAR_FEED_URL;

if (!configured) {
  throw new Error('CALENDAR_FEED_URL is not configured.');
}

/*
 * Use the existing calendar-feed URL, but request
 * the Exact Calls V1.1 feed.
 */
const url = new URL(configured);
url.searchParams.set('feed', 'hub-v2');

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function isNoRehearsal(record) {
  const status = normalizeUpper(record.status);
  const title = normalizeUpper(record.title);

  return (
    status === 'NO REHEARSAL' ||
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
        `Exact Calls feed returned HTTP ${response.status}`
      );
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/*
 * Validate the API envelope.
 *
 * Apps Script returns:
 *
 * {
 *   ok: true,
 *   schemaVersion: 3,
 *   rehearsals: [...]
 * }
 */
function getFeedRehearsals(feed) {
  if (!feed) {
    throw new Error(
      'Exact Calls feed returned no data.'
    );
  }

  if (feed.ok !== true) {
    throw new Error(
      'Exact Calls feed did not return ok=true.'
    );
  }

  if (feed.schemaVersion !== 3) {
    throw new Error(
      `Unsupported Exact Calls schemaVersion: ${feed.schemaVersion}`
    );
  }

  if (!Array.isArray(feed.rehearsals)) {
    throw new Error(
      'Exact Calls feed rehearsals property is not an array.'
    );
  }

  return feed.rehearsals;
}

/*
 * Convert the Exact Calls API schema into the
 * rehearsal schema already expected by the Hub.
 *
 * IMPORTANT:
 * We preserve the old Hub contract instead of
 * rewriting validate.mjs, build.mjs, and the UI.
 */
function adaptRehearsals(feedRehearsals) {
  const output = [];
  const seenIds = new Set();

  let excludedNoRehearsal = 0;

  for (const source of feedRehearsals) {
    /*
     * Administrative blackout / break rows stay in
     * Google Calendar data, but are not rehearsal
     * records for the Hub build pipeline.
     */
    if (isNoRehearsal(source)) {
      excludedNoRehearsal += 1;
      continue;
    }

    const id = normalizeText(
      source.id || source.eventKey
    );

    if (!id) {
      throw new Error(
        'Published rehearsal is missing both id and eventKey.'
      );
    }

    if (seenIds.has(id)) {
      throw new Error(
        `Duplicate rehearsal id: ${id}`
      );
    }

    seenIds.add(id);

    const start = normalizeText(source.start);
    const end = normalizeText(source.end);
    const title = normalizeText(source.title);

    /*
     * These are the exact fields required by
     * tools/validate.mjs.
     */
    if (!start || !end || !title) {
      throw new Error(
        `Rehearsal ${id} is missing required Hub fields. ` +
        `start="${start}", end="${end}", title="${title}"`
      );
    }

    const exactCallStatus =
      normalizeUpper(source.exactCallStatus);

    if (
      !['READY', 'REVIEW', 'HOLD']
        .includes(exactCallStatus)
    ) {
      throw new Error(
        `Invalid exactCallStatus ` +
        `"${source.exactCallStatus}" for ${id}`
      );
    }

    const calledPeopleIds =
      Array.isArray(source.calledPeopleIds)
        ? source.calledPeopleIds
        : [];

    const calledGroups =
      Array.isArray(source.calledGroups)
        ? source.calledGroups
        : [];

    const calledPeople =
      Array.isArray(source.calledPeople)
        ? source.calledPeople
        : [];

    /*
     * Only READY events may create confident
     * personalized calls.
     */
    if (
      exactCallStatus !== 'READY' &&
      (
        calledPeopleIds.length > 0 ||
        calledGroups.length > 0
      )
    ) {
      throw new Error(
        `Non-READY rehearsal ${id} contains ` +
        `personalized call targets.`
      );
    }

    /*
     * Compatibility object:
     *
     * - id satisfies the established Hub
     * - eventKey is retained for traceability
     * - Exact Calls fields ride alongside the
     *   existing rehearsal fields
     */
    const rehearsal = {
      ...source,

      id,
      eventKey: normalizeText(
        source.eventKey || id
      ),

      start,
      end,
      title,

      calledPeople,
      calledPeopleIds,
      calledGroups,

      exactCallStatus,
      callDataVersion: 3
    };

    output.push(rehearsal);
  }

  return {
    rehearsals: output,
    excludedNoRehearsal
  };
}

/*
 * Retry transient Google Apps Script/network errors.
 */
const attempts = [
  30000,
  30000,
  45000
];

let rehearsals = null;
let excludedNoRehearsal = 0;
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
      getFeedRehearsals(feed);

    const adapted =
      adaptRehearsals(
        feedRehearsals
      );

    rehearsals =
      adapted.rehearsals;

    excludedNoRehearsal =
      adapted.excludedNoRehearsal;

    break;

  } catch (error) {
    lastError = error;

    console.warn(
      `Attempt ${i + 1} failed: ` +
      `${error.message}`
    );

    if (
      i <
      attempts.length - 1
    ) {
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
 * The established Hub expects:
 *
 * data/rehearsals.json
 *
 * to be a plain rehearsal ARRAY.
 *
 * Do not write the Apps Script envelope here.
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
 * Atomic replacement protects the last known-good
 * Hub schedule if anything failed earlier.
 */
await fs.rename(
  tempPath,
  finalPath
);

/*
 * Reporting
 */
const ready =
  rehearsals.filter(
    r =>
      r.exactCallStatus ===
      'READY'
  ).length;

const review =
  rehearsals.filter(
    r =>
      r.exactCallStatus ===
      'REVIEW'
  ).length;

const hold =
  rehearsals.filter(
    r =>
      r.exactCallStatus ===
      'HOLD'
  ).length;

console.log(
  `Exact Calls sync OK: ` +
  `${rehearsals.length} rehearsal records; ` +
  `${ready} READY; ` +
  `${review} REVIEW; ` +
  `${hold} HOLD; ` +
  `${excludedNoRehearsal} NO REHEARSAL rows excluded.`
);

console.log(
  'Hub compatibility preserved: ' +
  'data/rehearsals.json contains id, start, end, title ' +
  'plus Exact Calls V1.1 fields.'
);
