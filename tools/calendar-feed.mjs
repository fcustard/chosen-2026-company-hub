// Public subscription calendar generated from the same approved Hub schedule.
const URL = 'https://fcustard.github.io/chosen-2026-company-hub/schedule.html';
const UID_DOMAIN = 'chosen-2026-company-hub.fcustard.github.io';

function dateStamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid calendar date');
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function textValue(value) {
  return String(value || '').replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;').replace(/,/g, '\\,');
}

// RFC 5545 lines may be at most 75 UTF-8 octets including the fold prefix.
function fold(line) {
  const lines = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, 'utf8');
    if (bytes + size > 75) {
      lines.push(current);
      current = ' ' + character;
      bytes = 1 + size;
    } else {
      current += character;
      bytes += size;
    }
  }
  lines.push(current);
  return lines.join('\r\n');
}

const PUBLIC_FIELDS = ['DTSTART', 'DTEND', 'SUMMARY', 'LOCATION', 'DESCRIPTION', 'URL', 'STATUS'];

function previousEvents(calendar) {
  const events = new Map();
  if (!calendar) return events;
  const unfolded = calendar.replace(/\r?\n[ \t]/g, '');
  for (const block of unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/g)) {
    const fields = Object.fromEntries(block[1].trim().split(/\r?\n/).map(line => {
      const colon = line.indexOf(':');
      return [line.slice(0, colon), line.slice(colon + 1)];
    }));
    if (!fields.UID || events.has(fields.UID) || !fields.DTSTART || !fields.DTEND) {
      throw new Error('Invalid previous subscription event');
    }
    events.set(fields.UID, fields);
  }
  if (!events.size) throw new Error('Previous subscription calendar has no events');
  return events;
}

function revisionLines(fields, previous, stamp) {
  const changed = !previous || PUBLIC_FIELDS.some(key => fields[key] !== previous[key]);
  const oldSequence = Number(previous?.SEQUENCE || 0);
  if (!Number.isSafeInteger(oldSequence) || oldSequence < 0) throw new Error('Invalid previous event sequence');
  const modified = changed ? stamp : (previous['LAST-MODIFIED'] || previous.DTSTAMP || stamp);
  return [
    'BEGIN:VEVENT',
    'UID:' + fields.UID,
    'DTSTAMP:' + modified,
    'LAST-MODIFIED:' + modified,
    'SEQUENCE:' + (oldSequence + (previous && changed ? 1 : 0)),
    ...PUBLIC_FIELDS.map(key => key + ':' + fields[key]),
    'END:VEVENT'
  ];
}

export function buildCalendarFeed(rehearsals, generatedAt = new Date(), previousCalendar = '') {
  if (!Array.isArray(rehearsals) || !rehearsals.length) {
    throw new Error('Cannot publish an empty calendar');
  }
  const stamp = dateStamp(generatedAt);
  const previous = previousEvents(previousCalendar);
  const seen = new Set();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CHOSEN 2026//Company Hub Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:CHOSEN 2026 Company Schedule',
    'X-WR-TIMEZONE:America/New_York',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H'
  ];
  for (const event of rehearsals) {
    if (!event || !event.id || !event.title || !event.location ||
        !event.start || !event.end || /NO REHEARSAL/i.test(event.status || '')) {
      throw new Error('Calendar event is missing approved public schedule fields');
    }
    if (!/^[A-Za-z0-9-]+$/.test(event.id) || seen.has(event.id)) {
      throw new Error('Duplicate or invalid calendar event ID: ' + event.id);
    }
    seen.add(event.id);
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new Error('Invalid calendar event window: ' + event.id);
    }
    const status = /CANCELLED|CANCELED/i.test(event.status || '') ? 'CANCELLED' :
      /PENDING|TENTATIVE|HOLD|REVIEW/i.test(event.status || '') ? 'TENTATIVE' : 'CONFIRMED';
    const showtime = event.showDay?.showtime;
    // Show day spans setup through release; make the performance start visible.
    // Read only the already-public showtime, never personal call fields.
    const performance = typeof showtime === 'string' && /^\d{1,2}:\d{2} (?:AM|PM)$/.test(showtime)
      ? showtime : '';
    const description = (performance ? `Show begins at ${performance}. ` : '') +
      'Check My Calls on the CHOSEN Hub for your personal report and release times. Changes may take time to appear in a subscribed calendar.';
    const fields = {
      UID: event.id + '@' + UID_DOMAIN,
      DTSTART: dateStamp(start), DTEND: dateStamp(end),
      SUMMARY: textValue(event.title + (performance ? ` (show at ${performance})` : '')),
      LOCATION: textValue(event.location), DESCRIPTION: textValue(description),
      URL, STATUS: status
    };
    lines.push(...revisionLines(fields, previous.get(fields.UID), stamp));
    previous.delete(fields.UID);
  }
  // Keep removed public events as cancellation notices through the season.
  // Subscribers that fetched an older version can then cancel the same UID.
  // Only allowlisted, already-public fields survive; private calls never enter ICS.
  for (const [uid, old] of previous) {
    const fields = Object.fromEntries(PUBLIC_FIELDS.map(key => [key, old[key] || '']));
    fields.UID = uid;
    fields.STATUS = 'CANCELLED';
    if (!/^Canceled — /.test(fields.SUMMARY)) fields.SUMMARY = 'Canceled — ' + fields.SUMMARY;
    lines.push(...revisionLines(fields, old, stamp));
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
