export const SOURCE_URL = 'https://docs.google.com/spreadsheets/d/1-d6_f2Yw5dMG4fRCjinw3ksdJkRNbISwoVvk1yJV1ks/edit#gid=1036204332';
export const EXPORT_URL = 'https://docs.google.com/spreadsheets/d/1-d6_f2Yw5dMG4fRCjinw3ksdJkRNbISwoVvk1yJV1ks/export?format=csv&gid=1036204332&range=A1%3AL1000';

export function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote; source was not published.');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function dateIso(value) {
  const m = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const date = new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
  if (date.getUTCMonth() !== +m[1] - 1 || date.getUTCDate() !== +m[2]) throw new Error('Invalid wardrobe date.');
  return date.toISOString().slice(0, 10);
}

export function minutes(value) {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] > 59) throw new Error(`Invalid fitting time: ${value}`);
  return (+m[1] % 12) * 60 + +m[2] + (m[3].toUpperCase() === 'PM' ? 720 : 0);
}

export function slotMinutes(value) {
  const m = String(value || '').match(/^(\d{1,2}:\d{2})\s*(AM|PM)?[–—-](\d{1,2}:\d{2})\s*(AM|PM)$/i);
  if (!m) throw new Error(`Invalid fitting slot: ${value}`);
  return [minutes(`${m[1]} ${m[2] || m[4]}`), minutes(`${m[3]} ${m[4]}`)];
}

export function parseWardrobe(rows) {
  const scheduleHeader = rows.findIndex(r => r[0] === 'Date' && r[1] === 'Day' && r[3] === 'Phase' && r[5] === 'Wardrobe Task');
  const fittingHeader = rows.findIndex(r => r[0] === 'Date' && r[1] === 'Time' && r[3] === 'Performer' && r[6] === 'Status');
  if (scheduleHeader < 0 || fittingHeader < 0) throw new Error('Wardrobe headers changed; preserve the last published plan.');
  const ruleStart = rows.findIndex((r, i) => i > scheduleHeader && r[0] === 'NON-NEGOTIABLE WARDROBE RULES');
  if (ruleStart < 0 || !rows[1]?.[0]?.startsWith('STATUS')) throw new Error('Wardrobe status/rules missing.');
  const schedule = rows.slice(scheduleHeader + 1, ruleStart).flatMap(r => {
    const date = dateIso(r[0]);
    if (!date || !r[3] || !r[4]) return []; // Ignore merged month dividers.
    if (!['Wed', 'Thu', 'Sat'].includes(r[1])) throw new Error('Wardrobe work must remain Wed/Thu/Sat.');
    return [{ date, day: r[1], time: r[2], phase: r[3], group: r[4], task: r[5], alignment: r[6], goal: r[7] }];
  });
  const fittings = rows.slice(fittingHeader + 1).flatMap(r => {
    const date = dateIso(r[0]);
    if (!date || !r[3]) return [];
    const buffer = r[6] === 'BUFFER';
    if (!buffer && !['1', '2'].includes(r[2])) throw new Error('Fitting station must be 1 or 2.');
    const [start, end] = slotMinutes(r[1]);
    if (end <= start || end - start > 10) throw new Error('Fitting slot exceeds 10 minutes.');
    if (!r[6]) throw new Error('Every fitting needs its source status.');
    return [{ date, time: r[1], station: r[2], performer: r[3], focus: r[4], alignment: r[5], status: r[6], notes: r[7], buffer }];
  });
  const milestones = rows.flatMap(r => {
    const date = dateIso(r[10]);
    return date && r[9] && r[11] ? [{ title: r[9], date, purpose: r[11] }] : [];
  });
  if (!schedule.length || !fittings.some(f => !f.buffer) || !milestones.length) throw new Error('Refusing to publish an empty wardrobe plan.');
  return {
    schemaVersion: 1, sourceUrl: SOURCE_URL, summary: rows[1][0],
    fittingTitle: rows[fittingHeader - 3]?.[0] || 'Fitting rotations',
    fittingPolicy: rows[fittingHeader - 2]?.[0] || '', schedule, fittings, milestones,
  };
}

export function validateFittings(plan, company, rehearsals) {
  const seen = new Set(), occupied = new Map();
  for (const f of plan.fittings.filter(f => !f.buffer)) {
    const person = company.people.find(p => p.name === f.performer);
    if (!person) throw new Error(`Unknown fitting performer: ${f.performer}`);
    const key = `${f.date}/${person.id}`;
    if (seen.has(key)) throw new Error(`Duplicate fitting: ${f.performer}`);
    seen.add(key);
    const [start, end] = slotMinutes(f.time);
    if (end <= start || end - start > 10 || !['1', '2'].includes(String(f.station))) throw new Error('Invalid fitting duration or station.');
    const stationKey = `${f.date}/${f.station}`;
    for (const prior of occupied.get(stationKey) || []) {
      if (start < prior[1] && end > prior[0]) throw new Error('Classroom fitting station is double-booked.');
    }
    occupied.set(stationKey, [...(occupied.get(stationKey) || []), [start, end]]);
    const event = rehearsals.find(r => (r.eventKey || r.id) === `CHOSEN-${f.date.replaceAll('-', '')}-REH`);
    const arrival = event?.personalCallTimes?.[person.id];
    const release = event?.personalCallEndTimes?.[person.id];
    // Approved slots must agree with the published personal calls before publication.
    if (/^APPROVED\b/.test(f.status) && (!arrival || !release || start < minutes(arrival) || end > minutes(release))) {
      throw new Error(`Approved fitting outside published personal call: ${f.performer}`);
    }
  }
}
