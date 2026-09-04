#!/usr/bin/env node

import fs from 'node:fs/promises';

const configured = process.env.CALENDAR_FEED_URL;

if (!configured) {
  throw new Error('CALENDAR_FEED_URL is not configured.');
}

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

function adaptRehearsals(feedRehearsals) {
  const output = [];
  const seenIds = new Set();

  let excludedNoRehearsal = 0;

  for (const source of feedRehearsals) {
    /*
     * The Apps Script hub-v2 feed already emits ONLY rows whose
     * Master Calendar Publish? field is YES.
     *
     * Therefore every rehearsal that survives this adapter is
     * authoritative published Hub data.
     *
     * IMPORTANT:
     * The established build.mjs still filters on r.publish.
     * We must explicitly preserve that legacy contract here.
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
     * Broad schedule-filter groups:
     *
     * Prefer a dedicated source.callGroups value if the feed ever
     * begins supplying it. Until then, use exact calledGroups as the
     * safest available published group signal.
     *
     * Full Company remains supported.
     */
    const callGroups =
      Array.isArray(source.callGroups)
        ? source.callGroups
        : Array.isArray(source.calledGroups)
          ? source.calledGroups
          : [];

    const rehearsal = {
      ...source,

      /*
       * REQUIRED LEGACY BUILD CONTRACT
       *
       * build.mjs uses:
       *   rehearsals.filter(r => r.publish)
       *
       * hub-v2 is already a published-only feed, so publish=true
       * is correct and intentional.
       */
      publish: true,

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
      callGroups,

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
 * FINAL PRE-WRITE CONTRACT CHECK
 *
 * This prevents the exact bug that caused Home / This Week /
 * Schedule to render empty while validation still appeared green.
 */
for (const r of rehearsals) {
  if (r.publish !== true) {
    throw new Error(
      `PUBLISH CONTRACT ERROR: ${r.id || r.eventKey} ` +
      `does not have publish=true before write.`
    );
  }
}

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

await fs.rename(
  tempPath,
  finalPath
);

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
  `${rehearsals.length} published rehearsal records; ` +
  `${ready} READY; ` +
  `${review} REVIEW; ` +
  `${hold} HOLD; ` +
  `${excludedNoRehearsal} NO REHEARSAL rows excluded.`
);

console.log(
  'Hub publication contract preserved: every rehearsal has publish=true.'
);
