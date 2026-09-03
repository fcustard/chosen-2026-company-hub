#!/usr/bin/env node
import fs from 'node:fs/promises';

const configured = process.env.CALENDAR_FEED_URL;
if (!configured) throw new Error('CALENDAR_FEED_URL is not configured.');

const url = new URL(configured);
url.searchParams.set('feed','hub-v2');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithTimeout(ms) {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), ms);
  try {
    const res = await fetch(url, { signal:c.signal, redirect:'follow', cache:'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

function validate(d) {
  if (!d || d.ok !== true || d.schemaVersion !== 3 || !Array.isArray(d.rehearsals))
    throw new Error('Invalid Exact Calls feed envelope.');

  const seen = new Set();
  for (const r of d.rehearsals) {
    if (!r.eventKey) throw new Error('Rehearsal missing eventKey.');
    if (seen.has(r.eventKey)) throw new Error(`Duplicate eventKey: ${r.eventKey}`);
    seen.add(r.eventKey);

    if (!['READY','REVIEW','HOLD'].includes(String(r.exactCallStatus || '').toUpperCase()))
      throw new Error(`Invalid exactCallStatus for ${r.eventKey}`);

    if (!Array.isArray(r.calledPeopleIds) || !Array.isArray(r.calledGroups))
      throw new Error(`Invalid call arrays for ${r.eventKey}`);

    if (r.exactCallStatus !== 'READY' &&
        (r.calledPeopleIds.length || r.calledGroups.length))
      throw new Error(`Non-READY event ${r.eventKey} contains personalized call targets.`);
  }
  return d;
}

let data, lastErr;
for (const [i,ms] of [30000,30000,45000].entries()) {
  try {
    console.log(`Exact Calls sync attempt ${i+1}/3...`);
    data = validate(await fetchWithTimeout(ms));
    break;
  } catch (e) {
    lastErr = e;
    console.warn(`Attempt ${i+1} failed: ${e.message}`);
    if (i < 2) await sleep((i+1)*3000);
  }
}

if (!data) {
  console.error(`EXACT CALLS SYNC ERROR: ${lastErr?.message || 'unknown error'}. Existing Hub rehearsal data was NOT changed.`);
  process.exit(1);
}

await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/rehearsals.json.tmp', JSON.stringify(data,null,2)+'\n','utf8');
await fs.rename('data/rehearsals.json.tmp','data/rehearsals.json');

const ready = data.rehearsals.filter(r=>r.exactCallStatus==='READY').length;
const review = data.rehearsals.filter(r=>r.exactCallStatus==='REVIEW').length;
console.log(`Exact Calls sync OK: ${data.rehearsals.length} rehearsals; ${ready} READY; ${review} REVIEW.`);
