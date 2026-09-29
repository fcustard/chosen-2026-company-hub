#!/usr/bin/env node

import fs from 'node:fs/promises';
import { createCalendarBaseline, mergeCalendarRehearsals } from './calendar-merge.mjs';

const configured = process.env.CALENDAR_FEED_URL;

if (!configured) {
  throw new Error('CALENDAR_FEED_URL is not configured.');
}

const DATA_DIR = 'data';
const FINAL_PATH = `${DATA_DIR}/rehearsals.json`;
const TEMP_PATH = `${FINAL_PATH}.tmp`;
const PROBE_ONLY = process.env.CALENDAR_SYNC_MODE === 'probe';
const SEED_BASELINE = process.env.CALENDAR_SYNC_MODE === 'seed';
const VERIFY_ONLY = process.env.CALENDAR_SYNC_MODE === 'verify';
const BASELINE_PATH = `${DATA_DIR}/calendar-source-baseline.json`;

/*
 * IMPORTANT
 * ---------
 * The repository variable may be stored as ?feed=hub because that URL is also
 * used by the public Hub. This sync step requires the Exact Calls feed, so this
 * script requests ?feed=hub-v2.
 *
 * If Google Apps Script returns HTML instead of JSON, we do NOT overwrite the
 * last known-good data/rehearsals.json.
 */

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function compactPreview(value, maxLength = 900) {
  return normalizeText(value)
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function workflowCommandValue(value) {
  return String(value ?? '')
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

function makeExactCallsUrl() {
  const url = new URL(configured);
  url.searchParams.set('feed', 'hub-v2');
  url.searchParams.set('_', String(Date.now()));
  return url;
}

function isNoRehearsal(record) {
  const status = normalizeUpper(record.status);
  const title = normalizeUpper(record.title);

  return (
    status === 'NO REHEARSAL' ||
    title.includes('NO REHEARSAL')
  );
}

function parseJsonWithDiagnostics(rawText, response, requestUrl) {
  const text = String(rawText ?? '').replace(/^\uFEFF/, '').trim();
  const contentType = response.headers.get('content-type') || 'unknown';

  if (!text) {
    throw new Error(
      `Exact Calls feed returned an empty response. ` +
      `HTTP ${response.status}; content-type="${contentType}"; ` +
      `url="${requestUrl}"`
    );
  }

  if (text.startsWith('<')) {
    throw new Error(
      `Exact Calls feed returned HTML instead of JSON. ` +
      `HTTP ${response.status}; content-type="${contentType}"; ` +
      `url="${requestUrl}"; preview="${compactPreview(text)}"`
    );
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Exact Calls feed returned invalid JSON: ${error.message}. ` +
      `HTTP ${response.status}; content-type="${contentType}"; ` +
      `url="${requestUrl}"; preview="${compactPreview(text)}"`
    );
  }
}

async function fetchJsonWithTimeout(requestUrl, ms) {
  const controller = new AbortController();

  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(requestUrl, {
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        accept: 'application/json,text/plain,*/*',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        'user-agent': 'CHOSEN-2026-Hub-Automation/1.0'
      }
    });

    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(
        `Exact Calls feed returned HTTP ${response.status}. ` +
        `content-type="${response.headers.get('content-type') || 'unknown'}"; ` +
        `url="${requestUrl}"; preview="${compactPreview(rawText)}"`
      );
    }

    return parseJsonWithDiagnostics(rawText, response, requestUrl);
  } finally {
    clearTimeout(timer);
  }
}

/*
 * Validate the API envelope.
 *
 * Expected Apps Script Exact Calls API:
 *
 * {
 *   ok: true,
 *   schemaVersion: 3,
 *   rehearsals: [...]
 * }
 */
function getFeedRehearsals(feed) {
  if (!feed) {
    throw new Error('Exact Calls feed returned no data.');
  }

  if (feed.ok !== true) {
    throw new Error(
      `Exact Calls feed did not return ok=true. ` +
      `Received ok=${JSON.stringify(feed.ok)}.`
    );
  }

  if (feed.schemaVersion !== 3) {
    throw new Error(
      `Unsupported Exact Calls schemaVersion: ${feed.schemaVersion}. ` +
      `This sync step requires feed=hub-v2 / schemaVersion 3. ` +
      `Do not downgrade to schemaVersion 1 because My Calls needs exact fields.`
    );
  }

  if (!Array.isArray(feed.rehearsals)) {
    throw new Error('Exact Calls feed rehearsals property is not an array.');
  }

  return feed.rehearsals;
}

/*
 * Convert the Exact Calls API schema into the rehearsal schema already expected
 * by the Hub.
 */
function adaptRehearsals(feedRehearsals) {
  const output = [];
  const seenIds = new Set();

  let excludedNoRehearsal = 0;

  for (const source of feedRehearsals) {
    if (isNoRehearsal(source)) {
      excludedNoRehearsal += 1;
      continue;
    }

    const id = normalizeText(source.id || source.eventKey);

    if (!id) {
      throw new Error('Published rehearsal is missing both id and eventKey.');
    }

    if (seenIds.has(id)) {
      throw new Error(`Duplicate rehearsal id: ${id}`);
    }

    seenIds.add(id);

    const start = normalizeText(source.start);
    const end = normalizeText(source.end);
    const title = normalizeText(source.title);

    if (!start || !end || !title) {
      throw new Error(
        `Rehearsal ${id} is missing required Hub fields. ` +
        `start="${start}", end="${end}", title="${title}"`
      );
    }

    const exactCallStatus = normalizeUpper(source.exactCallStatus);

    if (!['READY', 'REVIEW', 'HOLD'].includes(exactCallStatus)) {
      throw new Error(
        `Invalid exactCallStatus "${source.exactCallStatus}" for ${id}`
      );
    }

    const calledPeopleIds = Array.isArray(source.calledPeopleIds)
      ? source.calledPeopleIds.map(normalizeText).filter(Boolean)
      : [];

    const calledGroups = Array.isArray(source.calledGroups)
      ? source.calledGroups.map(normalizeText).filter(Boolean)
      : [];

    const calledPeople = Array.isArray(source.calledPeople)
      ? source.calledPeople.map(normalizeText).filter(Boolean)
      : [];

    /*
     * Only READY events may create confident personalized calls.
     */
    if (
      exactCallStatus !== 'READY' &&
      (
        calledPeopleIds.length > 0 ||
        calledGroups.length > 0
      )
    ) {
      throw new Error(
        `Non-READY rehearsal ${id} contains personalized call targets.`
      );
    }

    output.push({
      ...source,

      id,
      eventKey: normalizeText(source.eventKey || id),

      start,
      end,
      title,

      calledPeople,
      calledPeopleIds,
      calledGroups,

      exactCallStatus,
      callDataVersion: 3
    });
  }

  return {
    rehearsals: output,
    excludedNoRehearsal
  };
}

async function existingRehearsalsLookUsable() {
  try {
    const existing = JSON.parse(
      await fs.readFile(FINAL_PATH, 'utf8')
    );

    return Array.isArray(existing) && existing.length > 0;
  } catch {
    return false;
  }
}

/*
 * Retry transient Google Apps Script/network errors.
 */
const attempts = [30000, 30000, 45000];

let rehearsals = null;
let excludedNoRehearsal = 0;
let lastError = null;

for (let i = 0; i < attempts.length; i += 1) {
  const requestUrl = makeExactCallsUrl();

  try {
    console.log(
      `Exact Calls sync attempt ${i + 1}/${attempts.length}...`
    );
    console.log(
      `Requesting Exact Calls feed: ${requestUrl.toString()}`
    );

    const feed = await fetchJsonWithTimeout(
      requestUrl,
      attempts[i]
    );

    const feedRehearsals = getFeedRehearsals(feed);

    const adapted = adaptRehearsals(feedRehearsals);

    rehearsals = adapted.rehearsals;
    excludedNoRehearsal = adapted.excludedNoRehearsal;

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

if (!rehearsals) {
  const hasExisting = await existingRehearsalsLookUsable();
  const failureMessage = lastError?.message || 'unknown error';

  console.error(
    `::error title=CHOSEN Master Calendar feed rejected::` +
    workflowCommandValue(failureMessage)
  );

  console.error(
    `EXACT CALLS SYNC FAILED: ${failureMessage}.`
  );

  if (hasExisting) {
    console.error(
      `Existing Hub rehearsal data was NOT changed. ` +
      `The last known-good ${FINAL_PATH} was preserved, but this workflow is ` +
      `failing so stale calendar data cannot be published silently.`
    );
  } else {
    console.error(
      `No usable existing ${FINAL_PATH} was found, so the build cannot continue safely.`
    );
  }

  process.exit(1);
}

if (PROBE_ONLY) {
  const existing = JSON.parse(await fs.readFile(FINAL_PATH, 'utf8'));
  const byId = new Map(existing.map(record => [
    normalizeText(record.id || record.eventKey),
    record
  ]));
  const incomingIds = new Set();
  const watchedFields = [
    'start', 'end', 'title', 'location', 'status', 'called',
    'work', 'prep', 'calledPeopleIds', 'calledGroups',
    'exactCallStatus', 'personalCallTimes', 'personalCallEndTimes'
  ];
  const changed = [];
  for (const incoming of rehearsals) {
    incomingIds.add(incoming.id);
    const previous = byId.get(incoming.id);
    const fields = previous
      ? watchedFields.filter(field =>
          JSON.stringify(previous[field] ?? null) !==
          JSON.stringify(incoming[field] ?? null)
        )
      : ['NEW'];
    if (fields.length) changed.push({ id: incoming.id, fields });
  }
  const missing = [...byId.keys()].filter(id => !incomingIds.has(id));
  console.log('READ-ONLY Exact Calls probe; no Hub files were changed.');
  console.log(JSON.stringify({
    incomingCount: rehearsals.length,
    existingCount: existing.length,
    excludedNoRehearsal,
    incomingWithPersonalStart: rehearsals.filter(r => r.personalCallTimes).length,
    incomingWithPersonalEnd: rehearsals.filter(r => r.personalCallEndTimes).length,
    missing,
    changed
  }, null, 2));
  process.exit(0);
}

if (SEED_BASELINE) {
  const existing = JSON.parse(await fs.readFile(FINAL_PATH, 'utf8'));
  const existingIds = new Set(existing.map(r => r.id));
  const incomingIds = new Set(rehearsals.map(r => r.id));
  if (existingIds.size !== incomingIds.size ||
      [...existingIds].some(id => !incomingIds.has(id))) {
    throw new Error('Refusing to seed: feed event IDs differ from the reviewed Hub schedule.');
  }
  await fs.writeFile(BASELINE_PATH, JSON.stringify(createCalendarBaseline(rehearsals), null, 2) + '\n');
  console.log(`Seeded source fingerprints for ${rehearsals.length} events; published calls unchanged.`);
  process.exit(0);
}

const published = JSON.parse(await fs.readFile(FINAL_PATH, 'utf8'));
const baseline = JSON.parse(await fs.readFile(BASELINE_PATH, 'utf8'));
const merged = mergeCalendarRehearsals(rehearsals, published, baseline);
rehearsals = merged.rehearsals;
console.log(`Guarded calendar merge: ${merged.changes.length} event(s) changed.`);
for (const change of merged.changes) {
  console.log(`${change.id}: ${change.fields.join(', ')}`);
}
if (VERIFY_ONLY) {
  console.log('READ-ONLY guarded merge verified; no Hub files were changed.');
  process.exit(0);
}

/*
 * The established Hub expects data/rehearsals.json to be a plain rehearsal
 * ARRAY. Do not write the Apps Script envelope here.
 */
await fs.mkdir(DATA_DIR, { recursive: true });

await fs.writeFile(
  TEMP_PATH,
  JSON.stringify(rehearsals, null, 2) + '\n',
  'utf8'
);

/*
 * Atomic replacement protects the last known-good Hub schedule if anything
 * failed earlier.
 */
await fs.rename(TEMP_PATH, FINAL_PATH);
await fs.writeFile(
  `${BASELINE_PATH}.tmp`,
  JSON.stringify(merged.baseline, null, 2) + '\n',
  'utf8'
);
await fs.rename(`${BASELINE_PATH}.tmp`, BASELINE_PATH);

const ready = rehearsals.filter(
  r => r.exactCallStatus === 'READY'
).length;

const review = rehearsals.filter(
  r => r.exactCallStatus === 'REVIEW'
).length;

const hold = rehearsals.filter(
  r => r.exactCallStatus === 'HOLD'
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
