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

export function buildCalendarFeed(rehearsals, generatedAt = new Date()) {
  if (!Array.isArray(rehearsals) || !rehearsals.length) {
    throw new Error('Cannot publish an empty calendar');
  }
  const stamp = dateStamp(generatedAt);
  const seen = new Set();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CHOSEN 2026//Company Hub Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:CHOSEN 2026 Company Schedule',
    'X-WR-TIMEZONE:America/New_York',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H'
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
    const status = /PENDING|TENTATIVE|HOLD|REVIEW/i.test(event.status || '')
      ? 'TENTATIVE' : 'CONFIRMED';
    lines.push(
      'BEGIN:VEVENT',
      'UID:' + event.id + '@' + UID_DOMAIN,
      'DTSTAMP:' + stamp,
      'DTSTART:' + dateStamp(start),
      'DTEND:' + dateStamp(end),
      'SUMMARY:' + textValue(event.title),
      'LOCATION:' + textValue(event.location),
      'DESCRIPTION:' + textValue('Check My Calls on the CHOSEN Hub for your personal report and release times. Changes may take time to appear in a subscribed calendar.'),
      'URL:' + URL,
      'STATUS:' + status,
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
