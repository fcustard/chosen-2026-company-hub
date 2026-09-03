#!/usr/bin/env node
/**
 * CHOSEN 2026 — safe company feed sync
 * Required GitHub repository variable: COMPANY_FEED_URL
 *
 * Safety:
 * - retries transient Apps Script/network failures
 * - validates schema before writing
 * - writes atomically only after complete validation
 * - preserves last good data/company.json on failure
 */
import fs from 'node:fs/promises';

const url = process.env.COMPANY_FEED_URL;
if (!url) throw new Error('COMPANY_FEED_URL is not configured.');

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
  if (!d || d.ok !== true || d.schemaVersion !== 1 || !Array.isArray(d.people))
    throw new Error('Invalid company feed envelope.');
  const ids = new Set();
  for (const p of d.people) {
    if (!p.id || !p.name) throw new Error('Published person missing id/name.');
    if (ids.has(p.id)) throw new Error(`Duplicate person id: ${p.id}`);
    ids.add(p.id);
    if (!Array.isArray(p.departments) || !Array.isArray(p.groups) || !Array.isArray(p.assignments))
      throw new Error(`Invalid arrays for ${p.id}`);
    for (const a of p.assignments) {
      if (a.personId !== p.id) throw new Error(`Assignment/person mismatch for ${p.id}`);
    }
  }
  return d;
}

let data, lastErr;
const attempts = [30000,30000,45000];
for (let i=0;i<attempts.length;i++) {
  try {
    console.log(`Company sync attempt ${i+1}/${attempts.length}...`);
    data = validate(await fetchWithTimeout(attempts[i]));
    break;
  } catch (e) {
    lastErr=e;
    console.warn(`Attempt ${i+1} failed: ${e.message}`);
    if (i < attempts.length-1) await sleep((i+1)*3000);
  }
}
if (!data) {
  console.error(`COMPANY SYNC ERROR: ${lastErr?.message || 'unknown error'}. Existing Hub company data was NOT changed.`);
  process.exit(1);
}

await fs.mkdir('data',{recursive:true});
const tmp='data/company.json.tmp';
await fs.writeFile(tmp, JSON.stringify(data,null,2)+'\n','utf8');
await fs.rename(tmp,'data/company.json');
console.log(`Company sync OK: ${data.people.length} published people.`);
