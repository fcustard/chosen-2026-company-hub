import { parseCsv } from './wardrobe-feed.mjs';
import { mergeCalendarRehearsals } from './calendar-merge.mjs';

const SHEET = 'https://docs.google.com/spreadsheets/d/1-d6_f2Yw5dMG4fRCjinw3ksdJkRNbISwoVvk1yJV1ks/export?format=csv&gid=';
const MASTER = SHEET + '2140410104&range=A%3AAA';
const PERSONAL = SHEET + '851973977&range=A%3AG';
const trim = value => String(value ?? '').trim();
const split = (value, delimiter) => trim(value).split(delimiter).map(trim).filter(Boolean);

function sheetDate(value) {
  const text = trim(value);
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text)) {
    const date = new Date(text);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid published calendar date.');
    return date;
  }
  const m = text.match(/^([A-Za-z]{3}) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2}) (AM|PM)$/);
  if (!m) throw new Error('Invalid Master Calendar wall-clock date: ' + text);
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(m[1]);
  if (month < 0 || +m[4] < 1 || +m[4] > 12 || +m[5] > 59) throw new Error('Invalid Master Calendar time.');
  const target = Date.UTC(+m[3], month, +m[2], +m[4] % 12 + (m[6] === 'PM' ? 12 : 0), +m[5]);
  if (new Date(target).getUTCMonth() !== month || new Date(target).getUTCDate() !== +m[2]) throw new Error('Invalid calendar date.');
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hourCycle: 'h23', year:'numeric', month:'2-digit',
      day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit',
    }).formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    const rendered = Date.UTC(+parts.year, +parts.month-1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    const delta = rendered - target;
    if (!delta) return new Date(instant);
    instant -= delta;
  }
  throw new Error('Cannot resolve Master Calendar local time.');
}

function clock(value) {
  const m = trim(value).match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
  if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] > 59) throw new Error('Invalid personal call clock.');
  return +m[1] % 12 * 60 + +m[2] + (m[3] === 'PM' ? 720 : 0);
}

export function mergeFutureCalendarRows(rows, personalRows, company, published, baseline, now = new Date(), canceled = new Set()) {
  const header = rows.findIndex(r => r[0] === 'Date' && r[9] === 'Event Key');
  const requiredHeaders = { 0:'Date', 4:'Rehearsal Plan', 5:'Who Is Called', 9:'Event Key',
    10:'Start Date/Time', 11:'End Date/Time', 12:'Location', 13:'Public Status', 15:'Public Title',
    16:'Public Notes', 18:'Approval Status', 19:'Publish?', 23:'Called People (Exact)',
    24:'Called Groups (Exact)', 25:'Exact Call Status' };
  if (header < 0 || Object.entries(requiredHeaders).some(([i,name]) => rows[header][i] !== name)) throw new Error('Master Calendar headers changed.');
  if (personalRows[0]?.join('|') !== 'Event Key|Date|Person ID|Person|Report Time|Release Time|Status') throw new Error('Personal Calls headers changed.');
  if (!company.people?.length || !published.length) throw new Error('Refusing an empty company or schedule.');
  const byName = new Map(company.people.map(p => [p.name, p]));
  const byId = new Map(company.people.map(p => [p.id, p]));
  const groups = new Set(company.people.flatMap(p => p.groups || []).concat('Full Company'));
  const upcoming = [];
  const seen = new Set();
  for (const row of rows.slice(header + 1)) {
    if (!/^CHOSEN-\d{8}-[A-Z0-9-]+$/.test(trim(row[9]))) continue;
    if (trim(row[18]) !== 'APPROVED' || trim(row[19]) !== 'YES') continue;
    const id = trim(row[9]);
    const end = sheetDate(row[11]);
    if (end <= now || canceled.has(id)) continue;
    if (seen.has(id)) throw new Error('Duplicate future Event Key: ' + id);
    seen.add(id);
    const start = sheetDate(row[10]);
    if (end <= start || !trim(row[15]) || !trim(row[12]) || !trim(row[13])) throw new Error('Incomplete approved future event: ' + id);
    const status = trim(row[25]);
    if (!['READY','REVIEW','HOLD'].includes(status)) throw new Error('Invalid exact call status: ' + id);
    const names = status === 'READY' ? split(row[23], ',') : [];
    const calledGroups = status === 'READY' ? split(row[24], ';') : [];
    if (new Set(names).size !== names.length || new Set(calledGroups).size !== calledGroups.length) throw new Error('Duplicate exact targets: ' + id);
    const ids = names.map(name => {
      if (!byName.has(name)) throw new Error(id + ': unknown active called person ' + name);
      return byName.get(name).id;
    });
    if (calledGroups.some(group => !groups.has(group))) throw new Error('Unknown called group: ' + id);
    if (status === 'READY' && !ids.length && !calledGroups.length && !/CANCEL/i.test(trim(row[13]))) throw new Error('READY future event has no exact targets: ' + id);
    upcoming.push({ id, eventKey:id, start:trim(row[10]), end:trim(row[11]),
      title:trim(row[15]), location:trim(row[12]), status:trim(row[13]),
      called:trim(row[5]), work:trim(row[4]), prep:trim(row[16]), calledPeople:names,
      calledPeopleIds:ids, calledGroups, exactCallStatus:status, callDataVersion:3 });
  }
  if (!upcoming.length) throw new Error('No future approved events; preserving the published schedule.');
  const incoming = new Map(upcoming.map(r => [r.id, r]));
  const personal = new Map();
  for (const row of personalRows.slice(1)) {
    const key = trim(row[0]);
    if (!key || canceled.has(key)) continue;
    const event = incoming.get(key);
    if (!event) {
      const original = published.find(e => e.id === key);
      if (original && sheetDate(original.end) <= now) continue;
      throw new Error('Personal Calls event is not approved and future: ' + key);
    }
    const id = trim(row[2]);
    if (event.exactCallStatus !== 'READY' || trim(row[6]) !== 'READY' || byId.get(id)?.name !== trim(row[3])) throw new Error('Unconfirmed personal call: ' + key);
    const first = clock(row[4]), last = clock(row[5]);
    const eventFirst = clock(event.start.match(/\d{1,2}:\d{2} [AP]M$/)[0]);
    const eventLast = clock(event.end.match(/\d{1,2}:\d{2} [AP]M$/)[0]);
    if (first < eventFirst || last > eventLast || last <= first) throw new Error('Personal window outside event: ' + key);
    if (!personal.has(key)) personal.set(key, new Map());
    if (personal.get(key).has(id)) throw new Error('Duplicate personal window: ' + key);
    personal.get(key).set(id, { name:trim(row[3]), first:trim(row[4]), last:trim(row[5]) });
  }
  for (const [key, calls] of personal) {
    const event = incoming.get(key);
    if (event.calledPeopleIds.some(id => !calls.has(id))) throw new Error('Incomplete personal call roster: ' + key);
    event.calledPeopleIds = [...calls.keys()];
    event.calledPeople = [...calls.values()].map(p => p.name);
    event.calledGroups = [];
    event.personalCallTimes = Object.fromEntries([...calls].map(([id,p]) => [id,p.first]));
    event.personalCallEndTimes = Object.fromEntries([...calls].map(([id,p]) => [id,p.last]));
  }
  // Published historical records are immutable. Include every still-future
  // record in the guarded merge so a missing source row cannot delete it.
  const past = published.filter(r => sheetDate(r.end) <= now);
  const future = published.filter(r => sheetDate(r.end) > now && !canceled.has(r.id));
  const futureKeys = new Set([...future, ...upcoming].map(r => r.id));
  const futureBaseline = { schemaVersion:1, events:Object.fromEntries(Object.entries(baseline.events).filter(([key]) => futureKeys.has(key))) };
  const merged = mergeCalendarRehearsals(upcoming, future, futureBaseline);
  return { rehearsals:[...past, ...merged.rehearsals], baseline:{ schemaVersion:1, events:{ ...baseline.events, ...merged.baseline.events } }, changes:merged.changes };
}

async function fetchCsv(url) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url + '&_ts=' + Date.now(), { signal:AbortSignal.timeout(30000) });
      if (!response.ok || !response.headers.get('content-type')?.includes('csv')) throw new Error('Calendar CSV source unavailable.');
      return parseCsv(await response.text());
    } catch (e) { error = e; if (attempt < 2) await new Promise(resolve => setTimeout(resolve,2000)); }
  }
  throw error;
}

export async function syncFutureCalendar(company, published, baseline, canceled) {
  const [rows, personalRows] = await Promise.all([fetchCsv(MASTER), fetchCsv(PERSONAL)]);
  return mergeFutureCalendarRows(rows, personalRows, company, published, baseline, new Date(), canceled);
}
